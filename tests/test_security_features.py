import base64
import tempfile
import unittest
from pathlib import Path

import server
from scamshield.storage import Database


class SecurityFeatureTests(unittest.TestCase):
    def test_audit_csv_neutralizes_formula_prefixes(self):
        self.assertEqual(server.RequestHandler._csv_cell("=1+1"), "'=1+1")
        self.assertEqual(server.RequestHandler._csv_cell("  @SUM(A1)"), "'  @SUM(A1)")

    def test_totp_rfc_vector_and_replay_protection(self):
        secret = base64.b32encode(b"12345678901234567890").decode("ascii").rstrip("=")
        counter = server._totp_counter(secret, "287082", now=59)
        self.assertEqual(counter, 1)
        with tempfile.TemporaryDirectory() as directory:
            database = Database(Path(directory) / "test.sqlite3")
            self.assertTrue(database.claim_totp_counter("reviewer", counter))
            self.assertFalse(database.claim_totp_counter("reviewer", counter))

    def test_feed_validation_rejects_malformed_or_stale_feed(self):
        from datetime import datetime, timedelta, timezone

        from threat_intel import match_feed_payload, validate_feed_payload

        fresh = {
            "provider": "test",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "domains": ["phish.example"],
        }
        self.assertIsNone(validate_feed_payload(fresh))
        self.assertTrue(match_feed_payload("phish.example", fresh)["match"])
        invalid = {**fresh, "domains": ["https://phish.example/path"]}
        self.assertIsNotNone(validate_feed_payload(invalid))
        stale = {**fresh, "updated_at": (datetime.now(timezone.utc) - timedelta(days=15)).isoformat()}
        self.assertEqual(match_feed_payload("phish.example", stale)["status"], "stale")


if __name__ == "__main__":
    unittest.main()
