from __future__ import annotations

import json
import os
import re
import secrets
import sqlite3
import time
import uuid
from collections import defaultdict, deque
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from ipaddress import ip_address
from pathlib import Path
from urllib.parse import unquote, urlsplit

import psycopg
from psycopg_pool import PoolTimeout

from scamshield.analysis import SUPPORTED_LOCALES, analyze_message, analyze_url
from scamshield.storage import Database


ROOT = Path(__file__).resolve().parent
PUBLIC_DIR = ROOT / "public"
MODERATOR_DIR = ROOT / "moderator"
DB_PATH = Path(os.environ.get("SCAMSHIELD_DB", ROOT / "data" / "scamshield.sqlite3"))
ADMIN_TOKEN = os.environ.get("SCAMSHIELD_ADMIN_TOKEN", "")
ALLOWED_ORIGINS = {
    origin.strip()
    for origin in os.environ.get("SCAMSHIELD_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
}
TRUST_PROXY = os.environ.get("SCAMSHIELD_TRUST_PROXY", "").lower() == "true"
MAX_BODY_BYTES = 16_000
RATE_LIMIT = 20
RATE_WINDOW_SECONDS = 60


class ApiError(Exception):
    def __init__(self, status: HTTPStatus, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.message = message


class RequestHandler(BaseHTTPRequestHandler):
    server_version = "ScamShield/0.1"
    sys_version = ""
    requests_by_ip: dict[str, deque[float]] = defaultdict(deque)

    def log_message(self, format: str, *args: object) -> None:
        # Request paths can contain report tokens or submitted evidence.
        return

    def end_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' https://cdn.jsdelivr.net; img-src 'self' data: blob: https:; connect-src 'self' https://cdn.jsdelivr.net; media-src 'self' blob: data:; worker-src 'self' blob: https://cdn.jsdelivr.net; base-uri 'none'; form-action 'self'; frame-ancestors 'none'")
        self.send_header("Cache-Control", "no-store")
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
            self.send_header("Vary", "Origin")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        if not urlsplit(self.path).path.startswith("/api/"):
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        if self.headers.get("Origin") not in ALLOWED_ORIGINS:
            self.send_error(HTTPStatus.FORBIDDEN, "Origin is not allowed.")
            return
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def do_GET(self) -> None:
        path = urlsplit(self.path).path
        if path in {"/moderator", "/moderator/", "/moderator/index.html"}:
            self._serve_moderator("index.html")
            return
        if path in {"/moderator/moderator.css", "/moderator/moderator.js"}:
            self._serve_moderator(path.rsplit("/", 1)[-1])
            return
        if path == "/api/health":
            self._send_json(HTTPStatus.OK, {"status": "ok"})
            return
        if path == "/api/admin/reports":
            if not self._require_admin():
                return
            try:
                self._send_json(HTTPStatus.OK, {"reports": self.server.database.pending_reports()})
            except (sqlite3.Error, psycopg.Error, PoolTimeout, OSError):
                self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "The moderation queue could not be loaded."})
            return
        if path.startswith("/api/"):
            self._send_json(HTTPStatus.NOT_FOUND, {"error": "Not found"})
            return
        self._serve_static(path)

    def do_POST(self) -> None:
        if not self._allow_request():
            self._send_json(HTTPStatus.TOO_MANY_REQUESTS, {"error": "Too many requests. Please wait and try again."})
            return
        try:
            data = self._read_json()
            path = urlsplit(self.path).path
            if path == "/api/check/url":
                value = self._required_text(data, "url", 2048)
                result = analyze_url(value, self._locale(data))
                self._send_json(HTTPStatus.OK, result)
            elif path == "/api/check/message":
                value = self._required_text(data, "text", 6000)
                result = analyze_message(value, self._locale(data))
                self._send_json(HTTPStatus.OK, result)
            elif path == "/api/check/screenshot":
                value = self._required_text(data, "text", 6000)
                result = analyze_message(value, self._locale(data))
                self._send_json(HTTPStatus.OK, result)
            elif path == "/api/reports":
                result = self._create_report(data)
                self._send_json(HTTPStatus.CREATED, result)
            elif path == "/api/reports/status":
                token = self._required_text(data, "token", 128)
                report = self.server.database.get_report_by_token(token)
                if report is None:
                    raise ApiError(HTTPStatus.NOT_FOUND, "No report was found for that reference.")
                self._send_json(HTTPStatus.OK, {"reference": report["reference"], "status": report["status"], "updated_at": report["updated_at"]})
            else:
                raise ApiError(HTTPStatus.NOT_FOUND, "Not found")
        except ApiError as error:
            self._send_json(error.status, {"error": error.message})
        except ValueError as error:
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": "Send a valid JSON request."})
        except (sqlite3.Error, psycopg.Error, PoolTimeout, OSError):
            self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "The request could not be saved. Please try again later."})

    def do_PATCH(self) -> None:
        if not self._require_admin():
            return
        try:
            data = self._read_json()
            match = re.fullmatch(r"/api/admin/reports/([0-9a-f-]{36})", urlsplit(self.path).path)
            if match is None:
                raise ApiError(HTTPStatus.NOT_FOUND, "Not found")
            status = self._required_text(data, "status", 32)
            reason = self._required_text(data, "reason", 1000)
            if status not in {"verified", "rejected", "escalated"}:
                raise ApiError(HTTPStatus.BAD_REQUEST, "Choose verified, rejected, or escalated.")
            updated = self.server.database.review_report(match.group(1), status, reason)
            if not updated:
                raise ApiError(HTTPStatus.NOT_FOUND, "No pending report was found.")
            self._send_json(HTTPStatus.OK, {"updated": True})
        except ApiError as error:
            self._send_json(error.status, {"error": error.message})
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": "Send a valid JSON request."})
        except (sqlite3.Error, psycopg.Error, PoolTimeout, OSError):
            self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "The moderation action could not be saved."})

    def do_HEAD(self) -> None:
        path = urlsplit(self.path).path
        if path == "/api/health":
            self.send_response(HTTPStatus.OK)
            self.end_headers()
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def _read_json(self) -> dict[str, object]:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError as error:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Invalid request length.") from error
        if length <= 0 or length > MAX_BODY_BYTES:
            raise ApiError(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, "The request is empty or too large.")
        if self.headers.get_content_type() != "application/json":
            raise ApiError(HTTPStatus.UNSUPPORTED_MEDIA_TYPE, "Content-Type must be application/json.")
        raw = self.rfile.read(length)
        value = json.loads(raw.decode("utf-8"))
        if not isinstance(value, dict):
            raise ApiError(HTTPStatus.BAD_REQUEST, "The JSON body must be an object.")
        return value

    @staticmethod
    def _required_text(data: dict[str, object], key: str, maximum: int) -> str:
        value = data.get(key)
        if not isinstance(value, str) or not value.strip() or len(value) > maximum:
            raise ApiError(HTTPStatus.BAD_REQUEST, f"Enter {key} using no more than {maximum} characters.")
        return value.strip()

    @staticmethod
    def _locale(data: dict[str, object]) -> str:
        locale = data.get("locale", "en")
        if not isinstance(locale, str) or locale not in SUPPORTED_LOCALES:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Choose a supported language.")
        return locale

    def _create_report(self, data: dict[str, object]) -> dict[str, str]:
        category = self._required_text(data, "category", 32)
        raw_target = data.get("target", "")
        if not isinstance(raw_target, str) or len(raw_target) > 2048:
            raise ApiError(HTTPStatus.BAD_REQUEST, "The target must be text no longer than 2,048 characters.")
        target = raw_target.strip() or "(not provided)"
        summary = self._required_text(data, "summary", 2000)
        if category not in {"fake_shop", "job", "payment", "impersonation", "account", "other"}:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Choose a listed report category.")
        if len(summary) < 12:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Add a little more detail (at least 12 characters).")
        reference = secrets.token_urlsafe(24)
        report_id = str(uuid.uuid4())
        self.server.database.create_report(report_id, reference, category, target, summary)
        return {"reference": reference, "status": "pending", "message": "Your report is private and will not be published unless reviewed."}

    def _allow_request(self) -> bool:
        now = time.monotonic()
        address = self.client_address[0]
        if TRUST_PROXY:
            forwarded = self.headers.get("X-Forwarded-For", "").split(",")
            if forwarded:
                candidate = forwarded[-1].strip()
                try:
                    address = str(ip_address(candidate))
                except ValueError:
                    pass
        requests = self.requests_by_ip[address]
        while requests and now - requests[0] > RATE_WINDOW_SECONDS:
            requests.popleft()
        if len(requests) >= RATE_LIMIT:
            return False
        requests.append(now)
        return True

    def _require_admin(self) -> bool:
        if not ADMIN_TOKEN:
            self._send_json(HTTPStatus.SERVICE_UNAVAILABLE, {"error": "Moderation is not configured. Set SCAMSHIELD_ADMIN_TOKEN before enabling admin access."})
            return False
        supplied = self.headers.get("Authorization", "")
        expected = f"Bearer {ADMIN_TOKEN}"
        if not secrets.compare_digest(supplied, expected):
            self._send_json(HTTPStatus.UNAUTHORIZED, {"error": "Moderator authorization is required."})
            return False
        return True

    def _serve_static(self, path: str) -> None:
        if path in {"/", "/index.html"}:
            target = PUBLIC_DIR / "index.html"
        else:
            name = unquote(path.lstrip("/"))
            if not name or "/" in name or "\\" in name or name.startswith("."):
                self.send_error(HTTPStatus.NOT_FOUND)
                return
            target = PUBLIC_DIR / name
        if not target.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        content_type = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".svg": "image/svg+xml",
        }.get(target.suffix, "application/octet-stream")
        payload = target.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _serve_moderator(self, name: str) -> None:
        target = MODERATOR_DIR / name
        if not target.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        content_type = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
        }.get(target.suffix, "application/octet-stream")
        payload = target.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("X-Robots-Tag", "noindex, nofollow, noarchive")
        self.end_headers()
        self.wfile.write(payload)

    def _send_json(self, status: HTTPStatus, payload: dict[str, object]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class ScamShieldServer(ThreadingHTTPServer):
    def __init__(self, address: tuple[str, int], handler: type[RequestHandler], database: Database) -> None:
        super().__init__(address, handler)
        self.database = database


def main() -> None:
    host = os.environ.get("SCAMSHIELD_HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", os.environ.get("SCAMSHIELD_PORT", "8000")))
    database_url = os.environ.get("DATABASE_URL", "")
    if os.environ.get("SCAMSHIELD_DATABASE_REQUIRED", "").lower() == "true" and not database_url:
        raise RuntimeError("DATABASE_URL must be configured for this deployment.")
    database = Database(database_url or DB_PATH)
    server = ScamShieldServer((host, port), RequestHandler, database)
    print(f"ScamShield listening at http://{host}:{port} (Ctrl+C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping ScamShield.")
    finally:
        server.server_close()
        database.close()


if __name__ == "__main__":
    main()
