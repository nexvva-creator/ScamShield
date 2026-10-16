from __future__ import annotations

import sqlite3
import time
import uuid
import hashlib
import hmac
import secrets
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Database:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS reports (
                    id TEXT PRIMARY KEY,
                    reference TEXT NOT NULL UNIQUE,
                    category TEXT NOT NULL,
                    target TEXT NOT NULL,
                    summary TEXT NOT NULL,
                    evidence_notes TEXT NOT NULL DEFAULT '',
                    contact_channel TEXT NOT NULL DEFAULT 'unknown',
                    incident_date TEXT NOT NULL DEFAULT '',
                    locale TEXT NOT NULL DEFAULT 'en',
                    status TEXT NOT NULL CHECK (status IN ('pending', 'verified', 'rejected', 'escalated')),
                    assigned_to TEXT,
                    duplicate_of TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS reports_status_created ON reports(status, created_at);
                CREATE TABLE IF NOT EXISTS audit_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    report_id TEXT NOT NULL,
                    action TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(report_id) REFERENCES reports(id)
                );
                CREATE TABLE IF NOT EXISTS appeals (
                    id TEXT PRIMARY KEY,
                    report_id TEXT NOT NULL,
                    details TEXT NOT NULL,
                    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY(report_id) REFERENCES reports(id)
                );
                CREATE UNIQUE INDEX IF NOT EXISTS appeals_one_pending_per_report
                    ON appeals(report_id) WHERE status = 'pending';
                CREATE INDEX IF NOT EXISTS appeals_status_created ON appeals(status, created_at);
                CREATE TABLE IF NOT EXISTS result_feedback (
                    id TEXT PRIMARY KEY,
                    input_type TEXT NOT NULL CHECK (input_type IN ('url', 'message')),
                    input_hash TEXT NOT NULL,
                    locale TEXT NOT NULL,
                    risk_label TEXT NOT NULL,
                    details TEXT NOT NULL,
                    status TEXT NOT NULL CHECK (status IN ('pending', 'reviewed')),
                    created_at TEXT NOT NULL,
                    reference_hash TEXT
                );
                CREATE INDEX IF NOT EXISTS result_feedback_status_created ON result_feedback(status, created_at);
                CREATE TABLE IF NOT EXISTS case_notes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    report_id TEXT NOT NULL,
                    author TEXT NOT NULL,
                    kind TEXT NOT NULL CHECK (kind IN ('note', 'handoff')),
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(report_id) REFERENCES reports(id)
                );
                CREATE TABLE IF NOT EXISTS clarifications (
                    id TEXT PRIMARY KEY,
                    report_id TEXT NOT NULL,
                    author TEXT NOT NULL,
                    request TEXT NOT NULL,
                    reply TEXT NOT NULL DEFAULT '',
                    status TEXT NOT NULL CHECK (status IN ('open', 'answered')),
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY(report_id) REFERENCES reports(id)
                );
                CREATE INDEX IF NOT EXISTS clarifications_report_created
                    ON clarifications(report_id, created_at DESC);
                CREATE TABLE IF NOT EXISTS threat_feeds (
                    id TEXT PRIMARY KEY,
                    provider TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    status TEXT NOT NULL CHECK (status IN ('staged', 'active', 'archived')),
                    created_at TEXT NOT NULL,
                    activated_at TEXT NOT NULL DEFAULT ''
                );
                CREATE UNIQUE INDEX IF NOT EXISTS threat_feeds_one_active
                    ON threat_feeds(status) WHERE status = 'active';
                CREATE TABLE IF NOT EXISTS login_throttles (
                    bucket TEXT PRIMARY KEY,
                    window_started REAL NOT NULL,
                    attempts INTEGER NOT NULL,
                    locked_until REAL NOT NULL DEFAULT 0
                );
                CREATE TABLE IF NOT EXISTS security_settings (
                    setting TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS reviewer_totp_counters (
                    username TEXT PRIMARY KEY,
                    counter INTEGER NOT NULL
                );
                """
            )
            connection.execute(
                "INSERT OR IGNORE INTO security_settings (setting, value) VALUES ('login_throttle_key', ?)",
                (secrets.token_hex(32),),
            )
            columns = {row["name"] for row in connection.execute("PRAGMA table_info(reports)")}
            if "assigned_to" not in columns:
                connection.execute("ALTER TABLE reports ADD COLUMN assigned_to TEXT")
            if "duplicate_of" not in columns:
                connection.execute("ALTER TABLE reports ADD COLUMN duplicate_of TEXT")
            if "evidence_notes" not in columns:
                connection.execute("ALTER TABLE reports ADD COLUMN evidence_notes TEXT NOT NULL DEFAULT ''")
            for column, declaration in (
                ("contact_channel", "TEXT NOT NULL DEFAULT 'unknown'"),
                ("incident_date", "TEXT NOT NULL DEFAULT ''"),
                ("locale", "TEXT NOT NULL DEFAULT 'en'"),
            ):
                if column not in columns:
                    connection.execute(f"ALTER TABLE reports ADD COLUMN {column} {declaration}")
            feedback_columns = {row["name"] for row in connection.execute("PRAGMA table_info(result_feedback)")}
            if "reference_hash" not in feedback_columns:
                connection.execute("ALTER TABLE result_feedback ADD COLUMN reference_hash TEXT")
            connection.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS result_feedback_reference "
                "ON result_feedback(reference_hash) WHERE reference_hash IS NOT NULL"
            )

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.path, timeout=5)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        try:
            yield connection
            connection.commit()
        except BaseException:
            connection.rollback()
            raise
        finally:
            connection.close()

    def create_report(
        self, report_id: str, reference: str, category: str, target: str, summary: str,
        evidence_notes: str = "", contact_channel: str = "unknown",
        incident_date: str = "", locale: str = "en",
    ) -> str | None:
        now = _now()
        with self._connect() as connection:
            duplicate = connection.execute(
                """
                SELECT id FROM reports
                WHERE category = ? AND lower(trim(target)) = lower(trim(?))
                ORDER BY created_at DESC LIMIT 1
                """,
                (category, target),
            ).fetchone() if target != "(not provided)" else None
            connection.execute(
                "INSERT INTO reports (id, reference, category, target, summary, evidence_notes, contact_channel, incident_date, locale, status, duplicate_of, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)",
                (report_id, reference, category, target, summary, evidence_notes, contact_channel, incident_date, locale, duplicate["id"] if duplicate else None, now, now),
            )
            return duplicate["id"] if duplicate else None

    def get_report_by_token(self, reference: str) -> sqlite3.Row | None:
        with self._connect() as connection:
            return connection.execute(
                """
                SELECT reports.reference, reports.status, reports.updated_at,
                       (SELECT status FROM appeals WHERE appeals.report_id = reports.id
                        ORDER BY created_at DESC LIMIT 1) AS appeal_status
                FROM reports WHERE reference = ?
                """,
                (reference,),
            ).fetchone()

    def create_clarification(self, report_id: str, author: str, request: str) -> str | None:
        clarification_id = str(uuid.uuid4())
        now = _now()
        with self._connect() as connection:
            exists = connection.execute("SELECT 1 FROM reports WHERE id = ?", (report_id,)).fetchone()
            if exists is None:
                return None
            connection.execute(
                "INSERT INTO clarifications (id, report_id, author, request, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'open', ?, ?)",
                (clarification_id, report_id, author, request, now, now),
            )
            connection.execute(
                "INSERT INTO audit_log (report_id, action, reason, created_at) VALUES (?, 'clarification_requested', ?, ?)",
                (report_id, request, now),
            )
            return clarification_id

    def reply_to_clarification(self, reference: str, clarification_id: str, reply: str) -> bool:
        now = _now()
        with self._connect() as connection:
            cursor = connection.execute(
                """
                UPDATE clarifications SET reply = ?, status = 'answered', updated_at = ?
                WHERE id = ? AND status = 'open' AND report_id = (
                    SELECT id FROM reports WHERE reference = ?
                )
                """,
                (reply, now, clarification_id, reference),
            )
            return cursor.rowcount == 1

    def report_clarifications(self, reference: str) -> list[dict[str, str]]:
        with self._connect() as connection:
            return [dict(row) for row in connection.execute(
                """
                SELECT clarifications.id, clarifications.request, clarifications.reply,
                       clarifications.status, clarifications.created_at
                FROM clarifications JOIN reports ON reports.id = clarifications.report_id
                WHERE reports.reference = ? ORDER BY clarifications.created_at DESC LIMIT 10
                """, (reference,),
            ).fetchall()]

    def case_clarifications(self, report_id: str) -> list[dict[str, str]]:
        with self._connect() as connection:
            return [dict(row) for row in connection.execute(
                """
                SELECT author, request, reply, status, created_at, updated_at
                FROM clarifications WHERE report_id = ? ORDER BY created_at
                """, (report_id,),
            ).fetchall()]

    def stage_threat_feed(self, feed_id: str, provider: str, updated_at: str, payload: str) -> None:
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO threat_feeds (id, provider, updated_at, payload, status, created_at) VALUES (?, ?, ?, ?, 'staged', ?)",
                (feed_id, provider, updated_at, payload, _now()),
            )
            connection.execute(
                """
                DELETE FROM threat_feeds
                WHERE status = 'staged' AND id NOT IN (
                    SELECT id FROM threat_feeds WHERE status = 'staged'
                    ORDER BY created_at DESC, rowid DESC LIMIT 10
                )
                """
            )
            connection.execute(
                """
                DELETE FROM threat_feeds
                WHERE status = 'archived' AND (
                    activated_at = '' OR id NOT IN (
                        SELECT id FROM threat_feeds
                        WHERE status = 'archived' AND activated_at <> ''
                        ORDER BY activated_at DESC, rowid DESC LIMIT 10
                    )
                )
                """
            )

    def threat_feed_versions(self) -> list[dict[str, str]]:
        with self._connect() as connection:
            return [dict(row) for row in connection.execute(
                "SELECT id, provider, updated_at, status, created_at, activated_at FROM threat_feeds ORDER BY created_at DESC, rowid DESC LIMIT 50"
            ).fetchall()]

    def active_threat_feed(self) -> str | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT payload FROM threat_feeds WHERE status = 'active' LIMIT 1"
            ).fetchone()
            return row["payload"] if row else None

    def login_is_locked(self, username: str, address: str, now: float) -> bool:
        bucket = self._login_bucket(username, address)
        with self._connect() as connection:
            row = connection.execute(
                "SELECT locked_until FROM login_throttles WHERE bucket = ?", (bucket,),
            ).fetchone()
            return bool(row and row["locked_until"] > now)

    def record_login_failure(
        self, username: str, address: str, now: float,
        window_seconds: int, failure_limit: int, lock_seconds: int,
    ) -> bool:
        bucket = self._login_bucket(username, address)
        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT window_started, attempts, locked_until FROM login_throttles WHERE bucket = ?",
                (bucket,),
            ).fetchone()
            if row and row["locked_until"] > now:
                return True
            if row is None or now - row["window_started"] > window_seconds:
                started, attempts, locked_until = now, 1, 0.0
            else:
                started, attempts = row["window_started"], row["attempts"] + 1
                locked_until = now + lock_seconds if attempts >= failure_limit else 0.0
            connection.execute(
                "INSERT INTO login_throttles (bucket, window_started, attempts, locked_until) VALUES (?, ?, ?, ?) "
                "ON CONFLICT(bucket) DO UPDATE SET window_started = excluded.window_started, "
                "attempts = excluded.attempts, locked_until = excluded.locked_until",
                (bucket, started, attempts, locked_until),
            )
            connection.execute("DELETE FROM login_throttles WHERE locked_until < ? AND window_started < ?", (now, now - 86400))
            return locked_until > now

    def clear_login_failures(self, username: str, address: str) -> None:
        with self._connect() as connection:
            connection.execute("DELETE FROM login_throttles WHERE bucket = ?", (self._login_bucket(username, address),))

    def claim_totp_counter(self, username: str, counter: int) -> bool:
        with self._connect() as connection:
            cursor = connection.execute(
                "INSERT INTO reviewer_totp_counters (username, counter) VALUES (?, ?) "
                "ON CONFLICT(username) DO UPDATE SET counter = excluded.counter "
                "WHERE reviewer_totp_counters.counter < excluded.counter",
                (username, counter),
            )
            return cursor.rowcount == 1

    def _login_bucket(self, username: str, address: str) -> str:
        with self._connect() as connection:
            secret = connection.execute(
                "SELECT value FROM security_settings WHERE setting = 'login_throttle_key'"
            ).fetchone()["value"]
        message = f"{address}:{username.casefold()}".encode("utf-8")
        return hmac.new(bytes.fromhex(secret), message, hashlib.sha256).hexdigest()

    def backup_to(self, destination: Path) -> None:
        destination = destination.resolve()
        if destination == self.path.resolve():
            raise ValueError("Backup destination must differ from the live database.")
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_name(f".{destination.name}.{uuid.uuid4().hex}.tmp")
        try:
            source = sqlite3.connect(self.path, timeout=5)
            backup = sqlite3.connect(temporary, timeout=5)
            try:
                source.backup(backup)
                result = backup.execute("PRAGMA integrity_check").fetchone()
                if result is None or result[0] != "ok":
                    raise sqlite3.DatabaseError("Database backup integrity check failed.")
            finally:
                backup.close()
                source.close()
            temporary.replace(destination)
        finally:
            if temporary.exists():
                temporary.unlink()

    def activate_threat_feed(self, feed_id: str) -> bool:
        now = _now()
        with self._connect() as connection:
            chosen = connection.execute(
                "SELECT 1 FROM threat_feeds WHERE id = ? AND status IN ('staged', 'active')", (feed_id,),
            ).fetchone()
            if chosen is None:
                return False
            connection.execute(
                "UPDATE threat_feeds SET status = 'archived' WHERE status = 'active'"
            )
            connection.execute(
                "UPDATE threat_feeds SET status = 'active', activated_at = ? WHERE id = ?",
                (now, feed_id),
            )
            return True

    def rollback_threat_feed(self) -> bool:
        with self._connect() as connection:
            prior = connection.execute(
                "SELECT id FROM threat_feeds WHERE status = 'archived' AND activated_at <> '' ORDER BY activated_at DESC, rowid DESC LIMIT 1"
            ).fetchone()
            if prior is None:
                return False
            now = _now()
            connection.execute("UPDATE threat_feeds SET status = 'archived' WHERE status = 'active'")
            connection.execute(
                "UPDATE threat_feeds SET status = 'active', activated_at = ? WHERE id = ?",
                (now, prior["id"]),
            )
            return True

    def admin_reports(
        self, status: str, limit: int = 50, offset: int = 0, assigned_to: str = "",
        category: str = "", locale: str = "",
    ) -> list[dict[str, str | None]]:
        with self._connect() as connection:
            query = """
                SELECT reports.id, reports.category, reports.target, reports.summary,
                       reports.evidence_notes, reports.contact_channel, reports.incident_date,
                       reports.locale, reports.status, reports.assigned_to, reports.duplicate_of,
                       reports.created_at,
                       (SELECT id FROM clarifications WHERE report_id = reports.id
                        ORDER BY created_at DESC LIMIT 1) AS clarification_id,
                       (SELECT request FROM clarifications WHERE report_id = reports.id
                        ORDER BY created_at DESC LIMIT 1) AS clarification_request,
                       (SELECT reply FROM clarifications WHERE report_id = reports.id
                        ORDER BY created_at DESC LIMIT 1) AS clarification_reply,
                       (SELECT status FROM clarifications WHERE report_id = reports.id
                        ORDER BY created_at DESC LIMIT 1) AS clarification_status
                FROM reports
            """
            clauses: list[str] = []
            params: list[object] = []
            if status != "all":
                clauses.append("status = ?")
                params.append(status)
            if assigned_to:
                clauses.append("assigned_to IS NULL" if assigned_to == "__unassigned__" else "assigned_to = ?")
                if assigned_to != "__unassigned__":
                    params.append(assigned_to)
            if category:
                clauses.append("category = ?")
                params.append(category)
            if locale:
                clauses.append("locale = ?")
                params.append(locale)
            if clauses:
                query += " WHERE " + " AND ".join(clauses)
            query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
            rows = connection.execute(query, (*params, limit, offset)).fetchall()
            return [dict(row) for row in rows]

    def report_export(self, reference: str) -> dict[str, object] | None:
        with self._connect() as connection:
            report = connection.execute(
                """
                SELECT category, target, summary, evidence_notes, contact_channel,
                       incident_date, locale, status, created_at, updated_at
                FROM reports WHERE reference = ?
                """, (reference,),
            ).fetchone()
            if report is None:
                return None
            report_id = connection.execute(
                "SELECT id FROM reports WHERE reference = ?", (reference,),
            ).fetchone()["id"]
            appeals = [dict(row) for row in connection.execute(
                "SELECT details, status, created_at, updated_at FROM appeals WHERE report_id = ? ORDER BY created_at",
                (report_id,),
            ).fetchall()]
            return {"report": dict(report), "appeals": appeals}

    def report_trends(self, minimum_group_size: int = 5) -> list[dict[str, object]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT category, COUNT(*) AS count
                FROM reports
                WHERE status = 'verified'
                GROUP BY category
                HAVING COUNT(*) >= ?
                ORDER BY count DESC, category
                """, (minimum_group_size,),
            ).fetchall()
            return [dict(row) for row in rows]

    def operations_snapshot(
        self, started_at: float, database_path: Path, queue_alert_hours: int,
        retention_days: int = 365,
    ) -> dict[str, object]:
        threshold = max(1, min(queue_alert_hours, 24 * 365))
        with self._connect() as connection:
            row = connection.execute(
                "SELECT MIN(created_at) AS oldest FROM reports WHERE status = 'pending'",
            ).fetchone()
            pending = connection.execute(
                "SELECT COUNT(*) FROM reports WHERE status = 'pending'",
            ).fetchone()[0]
            workload_rows = connection.execute(
                """
                SELECT assigned_to, COUNT(*) AS pending,
                       MIN(created_at) AS oldest
                FROM reports WHERE status = 'pending' AND assigned_to IS NOT NULL
                GROUP BY assigned_to ORDER BY pending DESC, assigned_to LIMIT 100
                """
            ).fetchall()
            oldest = datetime.fromisoformat(row["oldest"]).timestamp() if row["oldest"] else None
            age_hours = max(0, int((datetime.now(timezone.utc).timestamp() - oldest) / 3600)) if oldest else None
            now = datetime.now(timezone.utc).timestamp()
            reviewer_workloads = [
                {
                    "reviewer": item["assigned_to"],
                    "pending_reports": item["pending"],
                    "oldest_pending_age_hours": max(
                        0, int((now - datetime.fromisoformat(item["oldest"]).timestamp()) / 3600),
                    ),
                }
                for item in workload_rows
            ]
        database_size = database_path.stat().st_size if database_path.exists() else 0
        alerts = []
        if age_hours is not None and age_hours >= threshold:
            alerts.append({
                "code": "pending_queue_age",
                "message": f"The oldest pending report is {age_hours} hours old (alert threshold: {threshold} hours).",
            })
        if database_size >= 512 * 1024 * 1024:
            alerts.append({"code": "database_size", "message": "The SQLite database has exceeded 512 MiB."})
        return {
            "status": "alert" if alerts else "ok",
            "uptime_seconds": int(time.monotonic() - started_at),
            "pending_reports": pending,
            "oldest_pending_age_hours": age_hours,
            "queue_alert_threshold_hours": threshold,
            "report_retention_days": max(1, min(retention_days, 3650)),
            "database_size_bytes": database_size,
            "pending_feedback": self.pending_feedback_count(),
            "reviewer_workloads": reviewer_workloads,
            "alerts": alerts,
        }

    def add_case_note(self, report_id: str, author: str, kind: str, content: str) -> bool:
        with self._connect() as connection:
            exists = connection.execute("SELECT 1 FROM reports WHERE id = ?", (report_id,)).fetchone()
            if exists is None:
                return False
            connection.execute(
                "INSERT INTO case_notes (report_id, author, kind, content, created_at) VALUES (?, ?, ?, ?, ?)",
                (report_id, author, kind, content, _now()),
            )
            return True

    def case_notes(self, report_id: str) -> list[dict[str, str]]:
        with self._connect() as connection:
            return [dict(row) for row in connection.execute(
                "SELECT author, kind, content, created_at FROM case_notes WHERE report_id = ? ORDER BY created_at",
                (report_id,),
            ).fetchall()]

    def report_is_assigned_to(self, report_id: str, username: str) -> bool:
        with self._connect() as connection:
            return connection.execute(
                "SELECT 1 FROM reports WHERE id = ? AND assigned_to = ?",
                (report_id, username),
            ).fetchone() is not None

    def create_result_feedback(
        self, feedback_id: str, input_type: str, input_hash: str, locale: str, risk_label: str, details: str,
        reference_hash: str | None = None,
    ) -> None:
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO result_feedback (id, input_type, input_hash, locale, risk_label, details, status, created_at, reference_hash) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)",
                (feedback_id, input_type, input_hash, locale, risk_label, details, _now(), reference_hash),
            )

    def result_feedback_status(self, reference_hash: str) -> str | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT status FROM result_feedback WHERE reference_hash = ?", (reference_hash,),
            ).fetchone()
            return row["status"] if row else None

    def pending_result_feedback(self, limit: int = 50) -> list[dict[str, str]]:
        with self._connect() as connection:
            return [dict(row) for row in connection.execute(
                "SELECT id, input_type, locale, risk_label, details, created_at FROM result_feedback WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?",
                (limit,),
            ).fetchall()]

    def review_result_feedback(self, feedback_id: str) -> bool:
        with self._connect() as connection:
            return connection.execute(
                "UPDATE result_feedback SET status = 'reviewed' WHERE id = ? AND status = 'pending'",
                (feedback_id,),
            ).rowcount == 1

    def assign_report(self, report_id: str, reviewer: str, reason: str) -> bool:
        now = _now()
        with self._connect() as connection:
            cursor = connection.execute(
                "UPDATE reports SET assigned_to = ?, updated_at = ? WHERE id = ? AND status = 'pending'",
                (reviewer, now, report_id),
            )
            if cursor.rowcount != 1:
                return False
            connection.execute(
                "INSERT INTO audit_log (report_id, action, reason, created_at) VALUES (?, 'assigned', ?, ?)",
                (report_id, reason, now),
            )
            return True

    def bulk_review_reports(self, report_ids: list[str], status: str, reason: str) -> int:
        now = _now()
        with self._connect() as connection:
            updated = 0
            for report_id in report_ids:
                cursor = connection.execute(
                    "UPDATE reports SET status = ?, updated_at = ? WHERE id = ? AND status = 'pending'",
                    (status, now, report_id),
                )
                if cursor.rowcount == 1:
                    connection.execute(
                        "INSERT INTO audit_log (report_id, action, reason, created_at) VALUES (?, ?, ?, ?)",
                        (report_id, status, reason, now),
                    )
                    updated += 1
            return updated

    def pending_feedback_count(self) -> int:
        with self._connect() as connection:
            return connection.execute(
                "SELECT COUNT(*) FROM result_feedback WHERE status = 'pending'"
            ).fetchone()[0]

    def erase_report(self, reference: str) -> bool:
        with self._connect() as connection:
            report = connection.execute("SELECT id FROM reports WHERE reference = ?", (reference,)).fetchone()
            if report is None:
                return False
            report_id = report["id"]
            connection.execute("DELETE FROM case_notes WHERE report_id = ?", (report_id,))
            connection.execute("DELETE FROM audit_log WHERE report_id = ?", (report_id,))
            connection.execute("DELETE FROM appeals WHERE report_id = ?", (report_id,))
            connection.execute("DELETE FROM clarifications WHERE report_id = ?", (report_id,))
            connection.execute("DELETE FROM reports WHERE id = ?", (report_id,))
            return True

    def delete_expired_reports(self, retention_days: int) -> int:
        cutoff = datetime.now(timezone.utc).timestamp() - retention_days * 86400
        with self._connect() as connection:
            rows = connection.execute("SELECT id, created_at FROM reports").fetchall()
            expired = [row["id"] for row in rows if datetime.fromisoformat(row["created_at"]).timestamp() < cutoff]
            for report_id in expired:
                connection.execute("DELETE FROM case_notes WHERE report_id = ?", (report_id,))
                connection.execute("DELETE FROM audit_log WHERE report_id = ?", (report_id,))
                connection.execute("DELETE FROM appeals WHERE report_id = ?", (report_id,))
                connection.execute("DELETE FROM clarifications WHERE report_id = ?", (report_id,))
                connection.execute("DELETE FROM reports WHERE id = ?", (report_id,))
            old_feedback = connection.execute("SELECT id, created_at FROM result_feedback").fetchall()
            expired_feedback = [
                row["id"] for row in old_feedback
                if datetime.fromisoformat(row["created_at"]).timestamp() < cutoff
            ]
            for feedback_id in expired_feedback:
                connection.execute("DELETE FROM result_feedback WHERE id = ?", (feedback_id,))
            return len(expired) + len(expired_feedback)

    def report_counts(self) -> dict[str, int]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT status, COUNT(*) AS count FROM reports GROUP BY status"
            ).fetchall()
            counts = {status: 0 for status in ("pending", "verified", "rejected", "escalated")}
            counts.update({row["status"]: row["count"] for row in rows})
            counts["appeals"] = connection.execute(
                "SELECT COUNT(*) FROM appeals WHERE status = 'pending'"
            ).fetchone()[0]
            return counts

    def audit_entries(self, limit: int = 100) -> list[dict[str, str]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT audit_log.report_id, audit_log.action, audit_log.reason,
                       audit_log.created_at, reports.category, reports.target
                FROM audit_log JOIN reports ON reports.id = audit_log.report_id
                ORDER BY audit_log.created_at DESC, audit_log.id DESC LIMIT ?
                """,
                (limit,),
            ).fetchall()
            return [dict(row) for row in rows]

    def create_appeal(self, reference: str, appeal_id: str, details: str) -> str:
        now = _now()
        with self._connect() as connection:
            report = connection.execute(
                "SELECT id, status FROM reports WHERE reference = ?", (reference,)
            ).fetchone()
            if report is None:
                return "not_found"
            if report["status"] == "pending":
                return "report_pending"
            existing = connection.execute(
                "SELECT 1 FROM appeals WHERE report_id = ? AND status = 'pending'",
                (report["id"],),
            ).fetchone()
            if existing:
                return "appeal_pending"
            connection.execute(
                "INSERT INTO appeals (id, report_id, details, status, created_at, updated_at) VALUES (?, ?, ?, 'pending', ?, ?)",
                (appeal_id, report["id"], details, now, now),
            )
            connection.execute(
                "INSERT INTO audit_log (report_id, action, reason, created_at) VALUES (?, 'appeal_submitted', ?, ?)",
                (report["id"], details, now),
            )
            return "created"

    def pending_appeals(self) -> list[dict[str, str]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT appeals.id, appeals.details, appeals.created_at,
                       reports.id AS report_id, reports.reference, reports.category,
                       reports.target, reports.summary, reports.evidence_notes,
                       reports.status AS report_status
                FROM appeals JOIN reports ON reports.id = appeals.report_id
                WHERE appeals.status = 'pending'
                ORDER BY appeals.created_at ASC
                """
            ).fetchall()
            return [dict(row) for row in rows]

    def review_appeal(self, appeal_id: str, status: str, reason: str) -> bool:
        now = _now()
        with self._connect() as connection:
            appeal = connection.execute(
                """
                SELECT appeals.report_id FROM appeals
                WHERE appeals.id = ? AND appeals.status = 'pending'
                """,
                (appeal_id,),
            ).fetchone()
            if appeal is None:
                return False
            connection.execute(
                "UPDATE appeals SET status = ?, updated_at = ? WHERE id = ?",
                (status, now, appeal_id),
            )
            if status == "accepted":
                connection.execute(
                    "UPDATE reports SET status = 'pending', updated_at = ? WHERE id = ?",
                    (now, appeal["report_id"]),
                )
            connection.execute(
                "INSERT INTO audit_log (report_id, action, reason, created_at) VALUES (?, ?, ?, ?)",
                (appeal["report_id"], f"appeal_{status}", reason, now),
            )
            return True

    def review_report(self, report_id: str, status: str, reason: str) -> bool:
        now = _now()
        with self._connect() as connection:
            cursor = connection.execute(
                "UPDATE reports SET status = ?, updated_at = ? WHERE id = ? AND status = 'pending'",
                (status, now, report_id),
            )
            if cursor.rowcount != 1:
                return False
            connection.execute(
                "INSERT INTO audit_log (report_id, action, reason, created_at) VALUES (?, ?, ?, ?)",
                (report_id, status, reason, now),
            )
            return True
