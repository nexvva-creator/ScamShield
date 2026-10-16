import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from threat_intel import apply_threat_result, match_local_feed


class LocalThreatFeedTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "feed.json"

    def tearDown(self):
        self.temp.cleanup()

    def write_feed(self, updated_at, domains):
        self.path.write_text(json.dumps({
            "provider": "Test feed",
            "updated_at": updated_at,
            "domains": domains,
        }), encoding="utf-8")

    def test_exact_fresh_feed_match_is_reported_with_provenance(self):
        updated_at = datetime.now(timezone.utc).isoformat()
        self.write_feed(updated_at, ["bad.example"])
        result = match_local_feed("bad.example", str(self.path))
        self.assertEqual(result["status"], "completed")
        self.assertTrue(result["match"])
        self.assertEqual(result["provider"], "Test feed")

    def test_stale_feed_is_not_used_for_a_match(self):
        updated_at = (datetime.now(timezone.utc) - timedelta(days=15)).isoformat()
        self.write_feed(updated_at, ["bad.example"])
        result = match_local_feed("bad.example", str(self.path))
        self.assertEqual(result["status"], "stale")
        self.assertFalse(result["match"])

    def test_feed_match_overrides_local_result_with_cautious_warning(self):
        result = {
            "coverage": [{"check": "local_rules", "status": "completed"}],
            "evidence": [],
            "decision_reason": [],
            "recommended_actions": [],
        }
        updated_at = datetime.now(timezone.utc).isoformat()
        self.write_feed(updated_at, ["bad.example"])
        reputation = match_local_feed("bad.example", str(self.path))
        applied = apply_threat_result(result, reputation)
        self.assertEqual(applied["risk_label"], "known_malicious")
        self.assertEqual(applied["coverage"][1]["provider"], "Test feed")
        self.assertEqual(applied["score"], 100)


if __name__ == "__main__":
    unittest.main()
