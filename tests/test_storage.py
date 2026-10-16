import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

from scamshield.storage import Database


class DatabaseMigrationTests(unittest.TestCase):
    def test_existing_feedback_table_gains_private_reference_index(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "legacy-feedback.sqlite3"
            with closing(sqlite3.connect(path)) as connection:
                connection.execute(
                    """
                    CREATE TABLE result_feedback (
                        id TEXT PRIMARY KEY,
                        input_type TEXT NOT NULL,
                        input_hash TEXT NOT NULL,
                        locale TEXT NOT NULL,
                        risk_label TEXT NOT NULL,
                        details TEXT NOT NULL,
                        status TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    )
                    """
                )
                connection.commit()
            database = Database(path)
            database.create_result_feedback(
                "feedback-id", "url", "0" * 64, "en", "unknown",
                "The result missed context.", "1" * 64,
            )
            self.assertEqual(database.result_feedback_status("1" * 64), "pending")

    def test_existing_reports_database_gains_new_optional_columns(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "legacy.sqlite3"
            with closing(sqlite3.connect(path)) as connection:
                connection.execute(
                    """
                    CREATE TABLE reports (
                        id TEXT PRIMARY KEY,
                        reference TEXT NOT NULL UNIQUE,
                        category TEXT NOT NULL,
                        target TEXT NOT NULL,
                        summary TEXT NOT NULL,
                        status TEXT NOT NULL,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    )
                    """
                )
                connection.commit()

            database = Database(path)
            with closing(sqlite3.connect(path)) as connection:
                columns = {row[1] for row in connection.execute("PRAGMA table_info(reports)")}
            self.assertTrue({"evidence_notes", "assigned_to", "duplicate_of"}.issubset(columns))

            database.create_report(
                "report-id", "private-reference", "job", "example.invalid", "A suspicious job offer.",
            )
            report = database.admin_reports("all")[0]
            self.assertEqual(report["evidence_notes"], "")
            self.assertIsNone(report["assigned_to"])
            self.assertIsNone(report["duplicate_of"])

    def test_clarification_workflow_deletion_and_verified_backup(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            database = Database(root / "source.sqlite3")
            database.create_report(
                "report-id", "private-reference", "job", "jobs.invalid", "A job asked for an advance fee.",
            )
            clarification_id = database.create_clarification(
                "report-id", "reviewer", "Please clarify when the payment was requested.",
            )
            self.assertIsNotNone(clarification_id)
            clarification = database.report_clarifications("private-reference")[0]
            self.assertEqual(clarification["status"], "open")
            self.assertTrue(database.reply_to_clarification(
                "private-reference", clarification_id, "The recruiter asked before the interview.",
            ))
            self.assertEqual(database.report_clarifications("private-reference")[0]["status"], "answered")
            backup = root / "backups" / "scamshield.sqlite3"
            database.backup_to(backup)
            with closing(sqlite3.connect(backup)) as connection:
                self.assertEqual(connection.execute("PRAGMA integrity_check").fetchone()[0], "ok")
                self.assertEqual(connection.execute("SELECT COUNT(*) FROM reports").fetchone()[0], 1)
            self.assertTrue(database.erase_report("private-reference"))
            self.assertEqual(database.report_clarifications("private-reference"), [])

    def test_login_throttle_survives_database_reopen(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "login.sqlite3"
            database = Database(path)
            now = 1_000_000.0
            self.assertFalse(database.record_login_failure("reviewer", "127.0.0.1", now, 900, 2, 900))
            reopened = Database(path)
            self.assertTrue(reopened.record_login_failure("reviewer", "127.0.0.1", now + 1, 900, 2, 900))
            self.assertTrue(reopened.login_is_locked("reviewer", "127.0.0.1", now + 2))
            reopened.clear_login_failures("reviewer", "127.0.0.1")
            self.assertFalse(reopened.login_is_locked("reviewer", "127.0.0.1", now + 2))

    def test_operations_snapshot_includes_assigned_workload(self):
        with tempfile.TemporaryDirectory() as directory:
            database = Database(Path(directory) / "operations.sqlite3")
            database.create_report(
                "report-id", "private-reference", "job", "jobs.invalid", "A job asked for an advance fee.",
            )
            self.assertTrue(database.assign_report(
                "report-id", "reviewer-a", "Assign for workload tracking.",
            ))
            snapshot = database.operations_snapshot(0, database.path, 72)
            self.assertEqual(snapshot["reviewer_workloads"][0]["reviewer"], "reviewer-a")
            self.assertEqual(snapshot["reviewer_workloads"][0]["pending_reports"], 1)


if __name__ == "__main__":
    unittest.main()
