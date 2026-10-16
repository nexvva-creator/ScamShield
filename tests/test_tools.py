import csv
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

from tools.backup_database import backup
from tools.evaluate_rules import evaluate


class OperationsToolsTests(unittest.TestCase):
    def test_database_backup_is_integrity_checked(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source.sqlite3"
            destination = Path(directory) / "backup.sqlite3"
            with closing(sqlite3.connect(source)) as connection:
                connection.execute("CREATE TABLE sample (value TEXT)")
                connection.execute("INSERT INTO sample VALUES ('preserved')")
                connection.commit()
            backup(source, destination)
            with closing(sqlite3.connect(destination)) as connection:
                self.assertEqual(connection.execute("PRAGMA integrity_check").fetchone()[0], "ok")
                self.assertEqual(connection.execute("SELECT value FROM sample").fetchone()[0], "preserved")

    def test_rule_evaluation_reports_rates_by_language_and_channel(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "samples.csv"
            with path.open("w", encoding="utf-8", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=["type", "input", "locale", "expected"])
                writer.writeheader()
                writer.writerow({"type": "message", "input": "Share your OTP immediately and pay a fee to claim your prize", "locale": "en", "expected": "scam"})
                writer.writerow({"type": "message", "input": "Your monthly statement is ready", "locale": "en", "expected": "benign"})
            result = evaluate(path)
            self.assertEqual(result["sample_count"], 2)
            self.assertEqual(result["groups"]["message:en"]["tp"], 1)
            self.assertEqual(result["groups"]["message:en"]["tn"], 1)


if __name__ == "__main__":
    unittest.main()
