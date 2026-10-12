import http.client
import json
import tempfile
import threading
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

import server
from scamshield.storage import Database


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.TemporaryDirectory()
        cls.database = Database(Path(cls.temp_dir.name) / "test.sqlite3")
        cls.httpd = server.ScamShieldServer(("127.0.0.1", 0), server.RequestHandler, cls.database)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()
        cls.port = cls.httpd.server_address[1]

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.thread.join(timeout=2)
        cls.temp_dir.cleanup()

    def setUp(self):
        server.ADMIN_TOKEN = "test-moderator-token"
        server.ALLOWED_ORIGINS = {"https://scamshield.example"}
        server.TRUST_PROXY = True
        server.RequestHandler.requests_by_ip.clear()

    def request(self, method, path, body=None, headers=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=2)
        payload = json.dumps(body).encode("utf-8") if body is not None else None
        request_headers = {"Content-Type": "application/json"} if payload is not None else {}
        request_headers.update(headers or {})
        connection.request(method, path, body=payload, headers=request_headers)
        response = connection.getresponse()
        raw = response.read()
        result = json.loads(raw) if response.getheader("Content-Type", "").startswith("application/json") else raw
        connection.close()
        return response.status, result

    def test_health_and_homepage(self):
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=2)
        connection.request("GET", "/api/health")
        response = connection.getresponse()
        self.assertEqual(response.status, 200)
        self.assertEqual(json.loads(response.read())["status"], "ok")
        self.assertTrue(response.getheader("X-Request-ID"))
        connection.close()

        status, page = self.request("GET", "/")
        self.assertEqual(status, 200)
        self.assertIn(b"Private by default", page)
        self.assertNotIn(b"Moderator", page)
        status, moderator_page = self.request("GET", "/moderator")
        self.assertEqual(status, 200)
        self.assertIn(b"Moderator sign-in", moderator_page)
        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=2)
        connection.request("GET", "/moderator")
        response = connection.getresponse()
        response.read()
        self.assertIn("noindex", response.getheader("X-Robots-Tag", ""))
        connection.close()

    def test_cors_allows_only_configured_frontend_origin(self):
        preflight_headers = {
            "Origin": "https://scamshield.example",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        }
        status, _ = self.request("OPTIONS", "/api/check/message", headers=preflight_headers)
        self.assertEqual(status, 204)

        connection = http.client.HTTPConnection("127.0.0.1", self.port, timeout=2)
        connection.request(
            "POST",
            "/api/check/message",
            body=json.dumps({"text": "Please send your verification code now."}),
            headers={"Content-Type": "application/json", "Origin": "https://scamshield.example"},
        )
        response = connection.getresponse()
        response.read()
        self.assertEqual(response.getheader("Access-Control-Allow-Origin"), "https://scamshield.example")
        connection.close()

        status, _ = self.request(
            "OPTIONS",
            "/api/check/message",
            headers={**preflight_headers, "Origin": "https://untrusted.example"},
        )
        self.assertEqual(status, 403)

    def test_rate_limit_uses_forwarded_client_ip_when_trusted(self):
        headers = {"X-Forwarded-For": "198.51.100.23"}
        for _ in range(server.RATE_LIMIT):
            status, _ = self.request(
                "POST",
                "/api/check/message",
                {"text": "A routine message for testing."},
                headers,
            )
            self.assertEqual(status, 200)

        status, _ = self.request(
            "POST",
            "/api/check/message",
            {"text": "Another routine message for testing."},
            headers,
        )
        self.assertEqual(status, 429)

        status, _ = self.request(
            "POST",
            "/api/check/message",
            {"text": "A separate client should still be allowed."},
            {"X-Forwarded-For": "198.51.100.24"},
        )
        self.assertEqual(status, 200)

    def test_moderator_assets_are_served_from_private_route(self):
        status, page = self.request("GET", "/moderator/moderator.js")
        self.assertEqual(status, 200)
        self.assertIn(b"/api/admin/reports", page)

    def test_invalid_scan_is_a_client_error(self):
        status, response = self.request("POST", "/api/check/url", {"url": "http://127.0.0.1"})
        self.assertEqual(status, 400)
        self.assertIn("Private or reserved", response["error"])

    def test_message_check_accepts_all_supported_locales(self):
        for locale, text in (
            ("es", "código otp"),
            ("fr", "code de vérification"),
            ("hi", "ओटीपी"),
            ("ar", "رمز OTP"),
        ):
            with self.subTest(locale=locale):
                status, response = self.request("POST", "/api/check/message", {
                    "text": f"Please send the {text} now",
                    "locale": locale,
                })
                self.assertEqual(status, 200)
                self.assertEqual(response["locale"], locale)
                self.assertNotEqual(response["evidence"][0]["text"], "The message asks for a password, PIN, OTP, or verification code.")

    def test_screenshot_check_uses_message_analysis(self):
        status, response = self.request("POST", "/api/check/screenshot", {
            "text": "Urgent! Please send the OTP immediately to avoid account lockout.",
            "locale": "en",
        })
        self.assertEqual(status, 200)
        self.assertEqual(response["input_type"], "message")
        self.assertIn("requests_secret", {item["type"] for item in response["evidence"]})

    def test_unsupported_locale_is_rejected(self):
        for locale in ("xx", "bn"):
            with self.subTest(locale=locale):
                status, response = self.request("POST", "/api/check/message", {
                    "text": "Suspicious text here",
                    "locale": locale,
                })
                self.assertEqual(status, 400)
                self.assertIn("supported language", response["error"])

    def test_non_string_locale_is_rejected_without_server_error(self):
        status, response = self.request("POST", "/api/check/message", {
            "text": "Suspicious text here",
            "locale": [],
        })
        self.assertEqual(status, 400)
        self.assertIn("supported language", response["error"])

    def test_report_is_private_and_requires_authorized_moderation(self):
        status, created = self.request("POST", "/api/reports", {
            "category": "job",
            "target": "",
            "summary": "Asked to pay an upfront registration fee.",
        })
        self.assertEqual(status, 201)
        self.assertEqual(created["status"], "pending")
        self.assertNotIn("asked to pay", str(created).lower())

        status, queue = self.request(
            "GET",
            "/api/admin/reports",
            headers={"Authorization": f"Bearer {server.ADMIN_TOKEN}"},
        )
        self.assertEqual(status, 200)
        self.assertEqual(len(queue["reports"]), 1)
        report = queue["reports"][0]
        self.assertEqual(report["target"], "(not provided)")

        status, _ = self.request("PATCH", f"/api/admin/reports/{report['id']}", {
            "status": "verified",
            "reason": "Reviewed supporting evidence.",
        })
        self.assertEqual(status, 401)
        status, _ = self.request("PATCH", f"/api/admin/reports/{report['id']}", {
            "status": "verified",
            "reason": "Reviewed supporting evidence.",
        }, {"Authorization": "Bearer test-moderator-token"})
        self.assertEqual(status, 200)

        status, lookup = self.request("POST", "/api/reports/status", {"token": created["reference"]})
        self.assertEqual(status, 200)
        self.assertEqual(lookup["status"], "verified")

    def test_admin_login_accepts_bearer_and_fallback_headers(self):
        status, response = self.request(
            "GET",
            "/api/admin/reports",
            headers={"Authorization": "Bearer test-moderator-token", "Origin": "https://scamshield.example"},
        )
        self.assertEqual(status, 200)
        self.assertIsInstance(response["reports"], list)

        status, response = self.request(
            "GET",
            "/api/admin/reports",
            headers={"X-ScamShield-Admin-Token": "test-moderator-token", "Origin": "https://scamshield.example"},
        )
        self.assertEqual(status, 200)

        status, response = self.request(
            "GET",
            "/api/admin/reports",
            headers={"Authorization": "Bearer test-moderator-token", "Origin": "https://untrusted.example"},
        )
        self.assertEqual(status, 403)

    def test_retention_policy_prunes_old_reports(self):
        database = Database(Path(self.temp_dir.name) / "retention.sqlite3")
        old_id = "old-report-id"
        fresh_id = "fresh-report-id"
        old_timestamp = (datetime.now(timezone.utc) - timedelta(days=400)).isoformat(timespec="seconds")
        fresh_timestamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
        with database._connect() as connection:
            connection.execute(
                "INSERT INTO reports (id, reference, category, target, summary, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)",
                (old_id, "old-ref", "job", "example.org", "Old report summary.", old_timestamp, old_timestamp),
            )
            connection.execute(
                "INSERT INTO reports (id, reference, category, target, summary, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)",
                (fresh_id, "fresh-ref", "job", "example.org", "Fresh report summary.", fresh_timestamp, fresh_timestamp),
            )

        database.retention_days = 365
        deleted = database.prune_expired_reports()
        self.assertEqual(deleted, 1)
        self.assertIsNone(database.get_report_by_token("old-ref"))
        self.assertIsNotNone(database.get_report_by_token("fresh-ref"))
        database.close()

    def test_admin_unavailable_without_configured_token(self):
        server.ADMIN_TOKEN = ""
        status, response = self.request("GET", "/api/admin/reports")
        self.assertEqual(status, 503)
        self.assertIn("not configured", response["error"])


if __name__ == "__main__":
    unittest.main()
