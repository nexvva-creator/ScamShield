from __future__ import annotations

import json
import os
import re
import secrets
import sqlite3
import time
import uuid
import hashlib
import hmac
import base64
import struct
import threading
import csv
import io
from collections import defaultdict, deque
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from ipaddress import ip_address
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

from scamshield.analysis import SUPPORTED_LOCALES, analyze_message, analyze_url
from scamshield.storage import Database
from threat_intel import apply_threat_result, match_local_feed, validate_feed_payload
from safety_tools import TRUSTED_ORGANIZATIONS, analyze_context_offer, check_email_headers, compare_organization_domain, safety_checklist


ROOT = Path(__file__).resolve().parent
PUBLIC_DIR = ROOT / "public"
DB_PATH = Path(os.environ.get("SCAMSHIELD_DB", ROOT / "data" / "scamshield.sqlite3"))
ADMIN_TOKEN = os.environ.get("SCAMSHIELD_ADMIN_TOKEN", "")
THREAT_FEED_PATH = os.environ.get("SCAMSHIELD_THREAT_FEED", "")
REPORT_RETENTION_DAYS = max(1, min(int(os.environ.get("SCAMSHIELD_REPORT_RETENTION_DAYS", "365")), 3650))
MAX_BODY_BYTES = 16_000
RATE_LIMIT = 20
RATE_WINDOW_SECONDS = 60
SESSION_TTL_SECONDS = 1800
PBKDF2_ITERATIONS = 310_000
LOGIN_FAILURE_LIMIT = 5
LOGIN_LOCK_SECONDS = 900
LOGIN_FAILURE_WINDOW = 900
MAX_FEED_UPLOAD_BYTES = 1_500_000


def _totp_counter(secret: str, code: str, now: float | None = None) -> int | None:
    if not re.fullmatch(r"\d{6}", code):
        return None
    try:
        key = base64.b32decode(secret + "=" * (-len(secret) % 8), casefold=False)
    except (ValueError, base64.binascii.Error):
        return None
    counter = int((time.time() if now is None else now) // 30)
    for candidate_counter in (counter - 1, counter, counter + 1):
        message = struct.pack(">Q", candidate_counter)
        digest = hmac.new(key, message, hashlib.sha1).digest()
        offset = digest[-1] & 0x0F
        value = (struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF) % 1_000_000
        if hmac.compare_digest(f"{value:06d}", code):
            return candidate_counter
    return None


def _verify_totp(secret: str, code: str) -> bool:
    return _totp_counter(secret, code) is not None


def _reviewer_accounts() -> dict[str, dict[str, str]]:
    raw = os.environ.get("SCAMSHIELD_REVIEWERS", "")
    if not raw:
        return {}
    try:
        accounts = json.loads(raw)
    except json.JSONDecodeError as error:
        raise RuntimeError("SCAMSHIELD_REVIEWERS must contain a JSON object.") from error
    if not isinstance(accounts, dict):
        raise RuntimeError("SCAMSHIELD_REVIEWERS must contain a JSON object.")
    for username, account in accounts.items():
        if (not isinstance(username, str) or not isinstance(account, dict) or
                not isinstance(account.get("salt"), str) or
                not re.fullmatch(r"[0-9a-f]{32}", account["salt"]) or
                not isinstance(account.get("password_hash"), str) or
                not re.fullmatch(r"[0-9a-f]{64}", account["password_hash"]) or
                account.get("role") not in {"admin", "reviewer"} or
                ("totp_secret" in account and
                 (not isinstance(account["totp_secret"], str) or
                  not re.fullmatch(r"[A-Z2-7]{16,64}", account["totp_secret"])))):
            raise RuntimeError(f"Reviewer {username!r} must have a hex salt, PBKDF2 hash, and admin/reviewer role.")
    return accounts


REVIEWER_ACCOUNTS = _reviewer_accounts()


class ApiError(Exception):
    def __init__(self, status: HTTPStatus, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.message = message


class RequestHandler(BaseHTTPRequestHandler):
    server_version = "ClearBeacon/0.1"
    sys_version = ""
    requests_by_ip: dict[str, deque[float]] = defaultdict(deque)

    def log_message(self, format: str, *args: object) -> None:
        # Request paths can contain report tokens or submitted evidence.
        return

    def end_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self) -> None:
        path = urlsplit(self.path).path
        if path == "/api/health":
            try:
                counts = self.server.database.report_counts()
                self._send_json(HTTPStatus.OK, {
                    "status": "ok",
                    "database": "ok",
                    "uptime_seconds": int(time.monotonic() - self.server.started_at),
                    "tracked_client_buckets": len(self.requests_by_ip),
                    "report_counts": counts,
                    "report_retention_days": REPORT_RETENTION_DAYS,
                })
            except sqlite3.Error:
                self._send_json(HTTPStatus.SERVICE_UNAVAILABLE, {"status": "degraded", "database": "unavailable"})
            return
        if path == "/api/public/organizations":
            self._send_json(HTTPStatus.OK, {"organizations": TRUSTED_ORGANIZATIONS})
            return
        if path == "/api/public/trends":
            try:
                self._send_json(HTTPStatus.OK, {
                    "minimum_group_size": 5,
                    "verified_reports_by_category": self.server.database.report_trends(5),
                    "notice": "Only categories with at least five verified reports are shown. Small groups are suppressed; counts are historical and not a live threat feed.",
                })
            except sqlite3.Error:
                self._send_json(HTTPStatus.SERVICE_UNAVAILABLE, {"error": "Aggregate trends are temporarily unavailable."})
            return
        if path == "/api/admin/reports":
            if not self._require_admin():
                return
            try:
                status_filter = parse_qs(urlsplit(self.path).query).get("status", ["pending"])[0]
                if status_filter not in {"all", "pending", "verified", "rejected", "escalated"}:
                    self._send_json(HTTPStatus.BAD_REQUEST, {"error": "Choose a valid report status filter."})
                    return
                query = parse_qs(urlsplit(self.path).query)
                try:
                    limit = min(max(int(query.get("limit", ["50"])[0]), 1), 100)
                    offset = max(int(query.get("offset", ["0"])[0]), 0)
                except ValueError:
                    self._send_json(HTTPStatus.BAD_REQUEST, {"error": "Pagination values must be integers."})
                    return
                assigned_to = query.get("assigned_to", [""])[0]
                if assigned_to == "me":
                    username = self._authenticated_username()
                    if username is None:
                        self._send_json(HTTPStatus.BAD_REQUEST, {"error": "A named reviewer account is required for this queue filter."})
                        return
                    assigned_to = username
                elif query.get("unassigned", ["false"])[0] == "true":
                    if self._authenticated_role() == "reviewer":
                        self._send_json(HTTPStatus.FORBIDDEN, {"error": "Reviewers can only access reports assigned to them."})
                        return
                    assigned_to = "__unassigned__"
                elif assigned_to and (
                    self._authenticated_role() != "admin" or assigned_to not in REVIEWER_ACCOUNTS
                ):
                    self._send_json(HTTPStatus.FORBIDDEN, {"error": "Only administrators can filter another reviewer's queue."})
                    return
                if self._authenticated_role() == "reviewer" and not assigned_to:
                    assigned_to = self._authenticated_username() or ""
                category = query.get("category", [""])[0]
                locale = query.get("locale", [""])[0]
                if category and category not in {"fake_shop", "job", "payment", "impersonation", "account", "other"}:
                    self._send_json(HTTPStatus.BAD_REQUEST, {"error": "Choose a valid report category."})
                    return
                if locale and locale not in SUPPORTED_LOCALES:
                    self._send_json(HTTPStatus.BAD_REQUEST, {"error": "Choose a supported language."})
                    return
                reports = self.server.database.admin_reports(
                    status_filter, limit, offset, assigned_to, category, locale,
                )
                self._send_json(HTTPStatus.OK, {"reports": reports, "limit": limit, "offset": offset,
                                                "has_more": len(reports) == limit})
            except sqlite3.Error:
                self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "The moderation queue could not be loaded."})
            return
        if path == "/api/admin/operations":
            if not self._require_admin():
                return
            try:
                snapshot = self.server.database.operations_snapshot(
                    self.server.started_at, self.server.database.path,
                    int(os.environ.get("SCAMSHIELD_QUEUE_ALERT_HOURS", "72")),
                    REPORT_RETENTION_DAYS,
                )
                backup_setting = os.environ.get("SCAMSHIELD_BACKUP_PATH", "")
                backup_path = Path(backup_setting) if backup_setting else None
                backup_exists = bool(backup_path and backup_path.is_file())
                backup_age = (
                    max(0, int((time.time() - backup_path.stat().st_mtime) / 3600))
                    if backup_path and backup_exists else None
                )
                snapshot["backup"] = {
                    "configured": backup_path is not None,
                    "exists": backup_exists,
                    "age_hours": backup_age,
                    "interval_hours": max(1, min(int(os.environ.get("SCAMSHIELD_BACKUP_INTERVAL_HOURS", "24")), 720)),
                }
                if backup_path is not None and not backup_exists:
                    snapshot["alerts"].append({
                        "code": "backup_missing",
                        "message": "Scheduled backups are configured, but no completed backup file exists yet.",
                    })
                    snapshot["status"] = "alert"
                self._send_json(HTTPStatus.OK, snapshot)
            except (sqlite3.Error, OSError, ValueError):
                self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "Operational status could not be loaded."})
            return
        if path == "/api/admin/overview":
            if not self._require_admin():
                return
            try:
                self._send_json(HTTPStatus.OK, {"counts": self.server.database.report_counts()})
            except sqlite3.Error:
                self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "The moderation overview could not be loaded."})
            return
        if path == "/api/admin/appeals":
            if not self._require_admin():
                return
            try:
                self._send_json(HTTPStatus.OK, {"appeals": self.server.database.pending_appeals()})
            except sqlite3.Error:
                self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "The appeal queue could not be loaded."})
            return
        if path == "/api/admin/audit":
            if not self._require_admin():
                return
            try:
                self._send_json(HTTPStatus.OK, {"entries": self.server.database.audit_entries()})
            except sqlite3.Error:
                self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "The moderation history could not be loaded."})
            return
        if path == "/api/admin/audit/export":
            if not self._require_admin():
                return
            try:
                rows = self.server.database.audit_entries(10_000)
                output = io.StringIO(newline="")
                writer = csv.writer(output)
                writer.writerow(("report_id", "action", "reason", "created_at", "category", "target"))
                for row in rows:
                    writer.writerow([
                        self._csv_cell(str(row.get(key, "")))
                        for key in ("report_id", "action", "reason", "created_at", "category", "target")
                    ])
                body = output.getvalue().encode("utf-8-sig")
                self.send_response(HTTPStatus.OK)
                self.send_header("Content-Type", "text/csv; charset=utf-8")
                self.send_header("Content-Disposition", 'attachment; filename="clearbeacon-audit.csv"')
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except sqlite3.Error:
                self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "The audit export could not be generated."})
            return
        if path == "/api/admin/feedback":
            if not self._require_admin():
                return
            try:
                self._send_json(HTTPStatus.OK, {"feedback": self.server.database.pending_result_feedback()})
            except sqlite3.Error:
                self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "The feedback queue could not be loaded."})
            return
        if path == "/api/admin/feed":
            if not self._require_admin():
                return
            if self._authenticated_role() != "admin":
                self._send_json(HTTPStatus.FORBIDDEN, {"error": "Only administrators can manage threat feeds."})
                return
            try:
                self._send_json(HTTPStatus.OK, {
                    "versions": self.server.database.threat_feed_versions(),
                    "configured_local_file": bool(THREAT_FEED_PATH),
                })
            except sqlite3.Error:
                self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "Threat-feed versions could not be loaded."})
            return
        if path == "/api/admin/sessions":
            if not self._require_admin():
                return
            if self._authenticated_role() != "admin":
                self._send_json(HTTPStatus.FORBIDDEN, {"error": "Only administrators can manage reviewer sessions."})
                return
            now = time.monotonic()
            sessions = [
                {"username": session[0], "role": session[1], "expires_in": max(0, int(session[2] - now))}
                for session in self.server.sessions.values()
                if len(session) >= 4 and session[2] > now and session[0] in REVIEWER_ACCOUNTS
            ]
            self._send_json(HTTPStatus.OK, {"sessions": sessions})
            return
        clarifications_match = re.fullmatch(r"/api/admin/reports/([0-9a-f-]{36})/clarifications", path)
        if clarifications_match:
            if not self._require_admin():
                return
            report_id = clarifications_match.group(1)
            username = self._authenticated_username()
            if (self._authenticated_role() == "reviewer" and
                    (username is None or not self.server.database.report_is_assigned_to(report_id, username))):
                self._send_json(HTTPStatus.FORBIDDEN, {"error": "This report is not assigned to your reviewer account."})
                return
            try:
                self._send_json(HTTPStatus.OK, {
                    "clarifications": self.server.database.case_clarifications(report_id),
                })
            except sqlite3.Error:
                self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "Clarification history could not be loaded."})
            return
        notes_match = re.fullmatch(r"/api/admin/reports/([0-9a-f-]{36})/notes", path)
        if notes_match:
            if not self._require_admin():
                return
            try:
                username = self._authenticated_username()
                if (self._authenticated_role() == "reviewer" and
                        (username is None or not self.server.database.report_is_assigned_to(notes_match.group(1), username))):
                    self._send_json(HTTPStatus.FORBIDDEN, {"error": "This report is not assigned to your reviewer account."})
                    return
                self._send_json(HTTPStatus.OK, {
                    "notes": self.server.database.case_notes(notes_match.group(1)),
                })
            except sqlite3.Error:
                self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "Case notes could not be loaded."})
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
            path = urlsplit(self.path).path
            data = self._read_json(MAX_FEED_UPLOAD_BYTES if path == "/api/admin/feed/stage" else MAX_BODY_BYTES)
            if path == "/api/admin/login":
                username = self._required_text(data, "username", 120)
                password = self._required_text(data, "password", 256)
                now = time.time()
                if self.server.database.login_is_locked(username, self.client_address[0], now):
                    self._send_json(HTTPStatus.TOO_MANY_REQUESTS, {"error": "Sign-in is temporarily locked. Try again later."})
                    return
                account = REVIEWER_ACCOUNTS.get(username)
                salt = bytes.fromhex(account["salt"]) if account else b"\0" * 16
                candidate = hashlib.pbkdf2_hmac(
                    "sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS,
                ).hex()
                expected = account["password_hash"] if account else "0" * 64
                authenticated = account is not None and hmac.compare_digest(candidate, expected)
                totp_secret = account.get("totp_secret", "") if account else ""
                if authenticated and totp_secret:
                    code = data.get("totp")
                    counter = _totp_counter(totp_secret, code) if isinstance(code, str) else None
                    authenticated = counter is not None and self.server.database.claim_totp_counter(username, counter)
                else:
                    counter = None
                if not authenticated:
                    if self.server.database.record_login_failure(
                        username, self.client_address[0], time.time(),
                        LOGIN_FAILURE_WINDOW, LOGIN_FAILURE_LIMIT, LOGIN_LOCK_SECONDS,
                    ):
                        raise ApiError(HTTPStatus.TOO_MANY_REQUESTS, "Sign-in is temporarily locked. Try again later.")
                    raise ApiError(HTTPStatus.UNAUTHORIZED, "Reviewer sign-in failed.")
                self.server.database.clear_login_failures(username, self.client_address[0])
                session_token = secrets.token_urlsafe(32)
                self.server.sessions[session_token] = (
                    username, account["role"], time.monotonic() + SESSION_TTL_SECONDS,
                    account["password_hash"],
                )
                self._send_json(HTTPStatus.OK, {
                    "token": session_token, "role": account["role"], "expires_in": SESSION_TTL_SECONDS,
                })
            elif path == "/api/admin/logout":
                token = self.headers.get("Authorization", "").removeprefix("Bearer ")
                self.server.sessions.pop(token, None)
                self._send_json(HTTPStatus.OK, {"logged_out": True})
            elif path == "/api/admin/feed/stage":
                if not self._require_admin():
                    return
                if self._authenticated_role() != "admin":
                    raise ApiError(HTTPStatus.FORBIDDEN, "Only administrators can manage threat feeds.")
                feed = data.get("feed")
                error = validate_feed_payload(feed)
                if error:
                    raise ApiError(HTTPStatus.BAD_REQUEST, error)
                assert isinstance(feed, dict)
                payload = json.dumps(feed, ensure_ascii=False, separators=(",", ":"))
                self.server.database.stage_threat_feed(
                    str(uuid.uuid4()), str(feed.get("provider", "local feed")),
                    str(feed["updated_at"]), payload,
                )
                self._send_json(HTTPStatus.CREATED, {"staged": True})
            elif path == "/api/admin/sessions/revoke":
                if not self._require_admin():
                    return
                if self._authenticated_role() != "admin":
                    raise ApiError(HTTPStatus.FORBIDDEN, "Only administrators can revoke reviewer sessions.")
                username = self._required_text(data, "username", 120)
                if username not in REVIEWER_ACCOUNTS:
                    raise ApiError(HTTPStatus.NOT_FOUND, "No configured reviewer account was found.")
                revoked = [
                    token for token, session in self.server.sessions.items()
                    if session[0] == username
                ]
                for token in revoked:
                    self.server.sessions.pop(token, None)
                self._send_json(HTTPStatus.OK, {"revoked": len(revoked)})
            elif path == "/api/admin/clarifications":
                if not self._require_admin():
                    return
                report_id = self._required_text(data, "report_id", 36)
                message = self._required_text(data, "message", 1000)
                if len(message) < 12 or not re.fullmatch(r"[0-9a-f-]{36}", report_id):
                    raise ApiError(HTTPStatus.BAD_REQUEST, "Enter a valid report and a clarification request of at least 12 characters.")
                username = self._authenticated_username()
                if (self._authenticated_role() == "reviewer" and
                        (username is None or not self.server.database.report_is_assigned_to(report_id, username))):
                    raise ApiError(HTTPStatus.FORBIDDEN, "This report is not assigned to your reviewer account.")
                clarification_id = self.server.database.create_clarification(
                    report_id, username or "legacy-admin", message,
                )
                if clarification_id is None:
                    raise ApiError(HTTPStatus.NOT_FOUND, "No report was found.")
                self._send_json(HTTPStatus.CREATED, {"id": clarification_id})
            elif path == "/api/check/url":
                value = self._required_text(data, "url", 2048)
                result = analyze_url(value, self._locale(data))
                active_feed = self.server.database.active_threat_feed()
                result = apply_threat_result(result, match_local_feed(
                    str(result["normalized_host"]), THREAT_FEED_PATH, active_feed,
                ))
                self._send_json(HTTPStatus.OK, result)
            elif path == "/api/check/message":
                value = self._required_text(data, "text", 6000)
                result = analyze_message(value, self._locale(data))
                self._send_json(HTTPStatus.OK, result)
            elif path == "/api/check/email-headers":
                headers = self._required_text(data, "headers", 12_000)
                self._send_json(HTTPStatus.OK, check_email_headers(headers))
            elif path == "/api/check/context":
                kind = self._required_text(data, "kind", 24)
                text = self._required_text(data, "text", 6000)
                self._send_json(HTTPStatus.OK, analyze_context_offer(kind, text))
            elif path == "/api/check/organization":
                value = self._required_text(data, "domain", 2048)
                self._send_json(HTTPStatus.OK, compare_organization_domain(value))
            elif path == "/api/check/checklist":
                scenario = self._required_text(data, "scenario", 32)
                self._send_json(HTTPStatus.OK, {"items": safety_checklist(scenario)})
            elif path == "/api/reports":
                result = self._create_report(data)
                self._send_json(HTTPStatus.CREATED, result)
            elif path == "/api/feedback":
                input_type = self._required_text(data, "input_type", 16)
                if input_type not in {"url", "message"}:
                    raise ApiError(HTTPStatus.BAD_REQUEST, "Choose url or message as the check type.")
                input_value = self._required_text(data, "input", 6000)
                risk_label = self._required_text(data, "risk_label", 32)
                details = self._required_text(data, "details", 1000)
                if len(details) < 8:
                    raise ApiError(HTTPStatus.BAD_REQUEST, "Feedback must contain at least 8 characters.")
                digest = hashlib.sha256(input_value.strip().casefold().encode("utf-8")).hexdigest()
                feedback_reference = secrets.token_urlsafe(32)
                reference_hash = hashlib.sha256(feedback_reference.encode("utf-8")).hexdigest()
                self.server.database.create_result_feedback(
                    str(uuid.uuid4()), input_type, digest, self._locale(data), risk_label, details,
                    reference_hash,
                )
                self._send_json(HTTPStatus.CREATED, {
                    "status": "pending", "reference": feedback_reference,
                })
            elif path == "/api/feedback/status":
                reference = self._required_text(data, "reference", 128)
                reference_hash = hashlib.sha256(reference.encode("utf-8")).hexdigest()
                status = self.server.database.result_feedback_status(reference_hash)
                if status is None:
                    raise ApiError(HTTPStatus.NOT_FOUND, "No feedback record was found for that reference.")
                self._send_json(HTTPStatus.OK, {"status": status})
            elif path == "/api/reports/delete":
                reference = self._required_text(data, "reference", 128)
                if not self.server.database.erase_report(reference):
                    raise ApiError(HTTPStatus.NOT_FOUND, "No report was found for that reference.")
                self._send_json(HTTPStatus.OK, {"deleted": True})
            elif path == "/api/reports/status":
                token = self._required_text(data, "token", 128)
                report = self.server.database.get_report_by_token(token)
                if report is None:
                    raise ApiError(HTTPStatus.NOT_FOUND, "No report was found for that reference.")
                self._send_json(HTTPStatus.OK, {
                    "reference": report["reference"],
                    "status": report["status"],
                    "updated_at": report["updated_at"],
                    "appeal_status": report["appeal_status"],
                    "clarifications": self.server.database.report_clarifications(token),
                })
            elif path == "/api/reports/clarifications/reply":
                reference = self._required_text(data, "reference", 128)
                clarification_id = self._required_text(data, "clarification_id", 36)
                message = self._required_text(data, "message", 2000)
                if len(message) < 8:
                    raise ApiError(HTTPStatus.BAD_REQUEST, "Reply with at least 8 characters.")
                if not self.server.database.reply_to_clarification(reference, clarification_id, message):
                    raise ApiError(HTTPStatus.NOT_FOUND, "No open clarification request was found for that reference.")
                self._send_json(HTTPStatus.CREATED, {"received": True})
            elif path == "/api/reports/export":
                reference = self._required_text(data, "reference", 128)
                report = self.server.database.report_export(reference)
                if report is None:
                    raise ApiError(HTTPStatus.NOT_FOUND, "No report was found for that reference.")
                self._send_json(HTTPStatus.OK, report)
            elif path == "/api/reports/appeals":
                reference = self._required_text(data, "reference", 128)
                details = self._required_text(data, "details", 1000)
                if len(details) < 12:
                    raise ApiError(HTTPStatus.BAD_REQUEST, "Add at least 12 characters explaining your appeal.")
                result = self.server.database.create_appeal(reference, str(uuid.uuid4()), details)
                if result == "not_found":
                    raise ApiError(HTTPStatus.NOT_FOUND, "No report was found for that reference.")
                if result == "report_pending":
                    raise ApiError(HTTPStatus.CONFLICT, "This report is already awaiting review and cannot be appealed yet.")
                if result == "appeal_pending":
                    raise ApiError(HTTPStatus.CONFLICT, "An appeal for this report is already awaiting review.")
                self._send_json(HTTPStatus.CREATED, {"status": "pending"})
            else:
                raise ApiError(HTTPStatus.NOT_FOUND, "Not found")
        except ApiError as error:
            self._send_json(error.status, {"error": error.message})
        except ValueError as error:
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": "Send a valid JSON request."})
        except (sqlite3.Error, OSError):
            self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "The request could not be saved. Please try again later."})

    def do_PATCH(self) -> None:
        if not self._require_admin():
            return
        try:
            data = self._read_json()
            path = urlsplit(self.path).path
            report_match = re.fullmatch(r"/api/admin/reports/([0-9a-f-]{36})", path)
            appeal_match = re.fullmatch(r"/api/admin/appeals/([0-9a-f-]{36})", path)
            if report_match:
                status = self._required_text(data, "status", 32)
                reason = self._required_text(data, "reason", 1000)
                username = self._authenticated_username()
                if (self._authenticated_role() == "reviewer" and
                        (username is None or not self.server.database.report_is_assigned_to(report_match.group(1), username))):
                    raise ApiError(HTTPStatus.FORBIDDEN, "This report is not assigned to your reviewer account.")
                if status not in {"verified", "rejected", "escalated"}:
                    raise ApiError(HTTPStatus.BAD_REQUEST, "Choose verified, rejected, or escalated.")
                updated = self.server.database.review_report(report_match.group(1), status, reason)
                if not updated:
                    raise ApiError(HTTPStatus.NOT_FOUND, "No pending report was found.")
            elif appeal_match:
                status = self._required_text(data, "status", 32)
                reason = self._required_text(data, "reason", 1000)
                if status not in {"accepted", "rejected"}:
                    raise ApiError(HTTPStatus.BAD_REQUEST, "Choose accepted or rejected.")
                updated = self.server.database.review_appeal(appeal_match.group(1), status, reason)
                if not updated:
                    raise ApiError(HTTPStatus.NOT_FOUND, "No pending appeal was found.")
            elif path == "/api/admin/reports/assign":
                reason = self._required_text(data, "reason", 1000)
                if self._authenticated_role() != "admin":
                    raise ApiError(HTTPStatus.FORBIDDEN, "Only administrators can assign reviewers.")
                report_id = self._required_text(data, "report_id", 36)
                reviewer = self._required_text(data, "reviewer", 80)
                if reviewer not in REVIEWER_ACCOUNTS:
                    raise ApiError(HTTPStatus.BAD_REQUEST, "Assign only to a configured reviewer account.")
                if not re.fullmatch(r"[0-9a-f-]{36}", report_id):
                    raise ApiError(HTTPStatus.BAD_REQUEST, "Choose a valid report.")
                updated = self.server.database.assign_report(report_id, reviewer, reason)
                if not updated:
                    raise ApiError(HTTPStatus.NOT_FOUND, "No pending report was found.")
            elif re.fullmatch(r"/api/admin/feedback/[0-9a-f-]{36}", path):
                feedback_id = path.rsplit("/", 1)[-1]
                if not self.server.database.review_result_feedback(feedback_id):
                    raise ApiError(HTTPStatus.NOT_FOUND, "No pending feedback was found.")
            elif (match := re.fullmatch(r"/api/admin/reports/([0-9a-f-]{36})/notes", path)):
                kind = self._required_text(data, "kind", 16)
                content = self._required_text(data, "content", 2000)
                if kind not in {"note", "handoff"}:
                    raise ApiError(HTTPStatus.BAD_REQUEST, "Choose note or handoff.")
                username = self._authenticated_username()
                if (self._authenticated_role() == "reviewer" and
                        (username is None or not self.server.database.report_is_assigned_to(match.group(1), username))):
                    raise ApiError(HTTPStatus.FORBIDDEN, "This report is not assigned to your reviewer account.")
                if not self.server.database.add_case_note(
                    match.group(1), self._authenticated_username() or "legacy-admin", kind, content,
                ):
                    raise ApiError(HTTPStatus.NOT_FOUND, "No report was found.")
            else:
                raise ApiError(HTTPStatus.NOT_FOUND, "Not found")
            self._send_json(HTTPStatus.OK, {"updated": True})
        except ApiError as error:
            self._send_json(error.status, {"error": error.message})
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": "Send a valid JSON request."})
        except (sqlite3.Error, OSError):
            self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "The moderation action could not be saved."})

    def do_PUT(self) -> None:
        if not self._require_admin():
            return
        if self._authenticated_role() != "admin":
            self._send_json(HTTPStatus.FORBIDDEN, {"error": "Only administrators can manage feeds or use bulk moderation."})
            return
        path = urlsplit(self.path).path
        if path in {"/api/admin/feed/activate", "/api/admin/feed/rollback"}:
            try:
                data = self._read_json()
                if path.endswith("/rollback"):
                    activated = self.server.database.rollback_threat_feed()
                else:
                    feed_id = self._required_text(data, "id", 36)
                    if not re.fullmatch(r"[0-9a-f-]{36}", feed_id):
                        raise ApiError(HTTPStatus.BAD_REQUEST, "Choose a valid staged feed version.")
                    activated = self.server.database.activate_threat_feed(feed_id)
                if not activated:
                    raise ApiError(HTTPStatus.CONFLICT, "No eligible feed version is available for that action.")
                self._send_json(HTTPStatus.OK, {"updated": True})
            except ApiError as error:
                self._send_json(error.status, {"error": error.message})
            except (json.JSONDecodeError, UnicodeDecodeError):
                self._send_json(HTTPStatus.BAD_REQUEST, {"error": "Send a valid JSON request."})
            except sqlite3.Error:
                self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "The threat-feed action could not be saved."})
            return
        if path != "/api/admin/reports/bulk":
            self._send_json(HTTPStatus.NOT_FOUND, {"error": "Not found"})
            return
        try:
            data = self._read_json()
            report_ids = data.get("report_ids")
            if not isinstance(report_ids, list) or not 1 <= len(report_ids) <= 50 or any(
                not isinstance(item, str) or not re.fullmatch(r"[0-9a-f-]{36}", item) for item in report_ids
            ):
                raise ApiError(HTTPStatus.BAD_REQUEST, "Choose 1 to 50 valid report IDs.")
            status = self._required_text(data, "status", 32)
            reason = self._required_text(data, "reason", 1000)
            if status not in {"verified", "rejected", "escalated"}:
                raise ApiError(HTTPStatus.BAD_REQUEST, "Choose verified, rejected, or escalated.")
            count = self.server.database.bulk_review_reports(report_ids, status, reason)
            self._send_json(HTTPStatus.OK, {"updated": count})
        except ApiError as error:
            self._send_json(error.status, {"error": error.message})
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": "Send a valid JSON request."})
        except (sqlite3.Error, OSError):
            self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "The bulk moderation action could not be saved."})

    def do_HEAD(self) -> None:
        path = urlsplit(self.path).path
        if path == "/api/health":
            self.send_response(HTTPStatus.OK)
            self.end_headers()
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def _read_json(self, maximum: int = MAX_BODY_BYTES) -> dict[str, object]:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError as error:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Invalid request length.") from error
        if length <= 0 or length > maximum:
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
    def _csv_cell(value: str) -> str:
        return f"'{value}" if value.lstrip().startswith(("=", "+", "-", "@")) else value

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
        evidence_notes = data.get("evidence_notes", "")
        if not isinstance(evidence_notes, str) or len(evidence_notes) > 3000:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Evidence notes must be text no longer than 3,000 characters.")
        evidence_notes = evidence_notes.strip()
        contact_channel = data.get("contact_channel", "unknown")
        if contact_channel not in {"unknown", "email", "phone", "text", "social", "marketplace", "website", "in_person", "other"}:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Choose a listed contact channel.")
        incident_date = data.get("incident_date", "")
        if not isinstance(incident_date, str) or len(incident_date) > 10:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Enter a valid incident date.")
        if incident_date:
            try:
                from datetime import date
                date.fromisoformat(incident_date)
            except ValueError as error:
                raise ApiError(HTTPStatus.BAD_REQUEST, "Enter a valid incident date.") from error
        if category not in {"fake_shop", "job", "payment", "impersonation", "account", "other"}:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Choose a listed report category.")
        if len(summary) < 12:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Add a little more detail (at least 12 characters).")
        reference = secrets.token_urlsafe(24)
        report_id = str(uuid.uuid4())
        locale = self._locale(data)
        duplicate_id = self.server.database.create_report(
            report_id, reference, category, target, summary, evidence_notes,
            str(contact_channel), incident_date, locale,
        )
        return {"reference": reference, "status": "pending", "possible_duplicate": duplicate_id is not None,
                "message": "Your report is private and will not be published unless reviewed."}

    def _allow_request(self) -> bool:
        now = time.monotonic()
        address = self.client_address[0]
        requests = self.requests_by_ip[address]
        while requests and now - requests[0] > RATE_WINDOW_SECONDS:
            requests.popleft()
        if len(requests) >= RATE_LIMIT:
            return False
        requests.append(now)
        return True

    def _require_admin(self) -> bool:
        if self._authenticated_role():
            return True
        if not ADMIN_TOKEN and not REVIEWER_ACCOUNTS:
            self._send_json(HTTPStatus.SERVICE_UNAVAILABLE, {"error": "Moderation is not configured. Set SCAMSHIELD_REVIEWERS before enabling admin access."})
            return False
        supplied = self.headers.get("Authorization", "")
        expected = f"Bearer {ADMIN_TOKEN}"
        if not secrets.compare_digest(supplied, expected):
            self._send_json(HTTPStatus.UNAUTHORIZED, {"error": "Moderator authorization is required."})
            return False
        return True

    def _authenticated_role(self) -> str | None:
        supplied = self.headers.get("Authorization", "")
        if supplied.startswith("Bearer "):
            token = supplied[7:]
            session = self.server.sessions.get(token)
            if session:
                username, role, expires_at, *session_hash = session
                account = REVIEWER_ACCOUNTS.get(username)
                if (time.monotonic() < expires_at and account is not None and
                        account["role"] == role and session_hash and
                        hmac.compare_digest(session_hash[0], account["password_hash"])):
                    return role
                self.server.sessions.pop(token, None)
        if ADMIN_TOKEN:
            expected = f"Bearer {ADMIN_TOKEN}"
            if secrets.compare_digest(supplied, expected):
                return "admin"
        return None

    def _authenticated_username(self) -> str | None:
        supplied = self.headers.get("Authorization", "")
        if supplied.startswith("Bearer "):
            session = self.server.sessions.get(supplied[7:])
            if (session and time.monotonic() < session[2] and
                    session[0] in REVIEWER_ACCOUNTS and len(session) > 3 and
                    session[1] == REVIEWER_ACCOUNTS[session[0]]["role"] and
                    hmac.compare_digest(session[3], REVIEWER_ACCOUNTS[session[0]]["password_hash"])):
                return session[0]
        return None

    def _serve_static(self, path: str) -> None:
        if path in {"/", "/index.html"}:
            target = PUBLIC_DIR / "index.html"
        elif path == "/admin":
            target = PUBLIC_DIR / "admin.html"
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
        self.started_at = time.monotonic()
        self.sessions: dict[str, tuple[str, str, float, str]] = {}
        self.maintenance_stop = threading.Event()


def main() -> None:
    host = os.environ.get("SCAMSHIELD_HOST", "127.0.0.1")
    port = int(os.environ.get("SCAMSHIELD_PORT", "8000"))
    database = Database(DB_PATH)
    deleted = database.delete_expired_reports(REPORT_RETENTION_DAYS)
    if deleted:
        print(f"Retention cleanup removed {deleted} expired reports.")
    server = ScamShieldServer((host, port), RequestHandler, database)
    backup_path = Path(os.environ["SCAMSHIELD_BACKUP_PATH"]) if os.environ.get("SCAMSHIELD_BACKUP_PATH") else None
    backup_interval_seconds = max(3600, min(int(os.environ.get("SCAMSHIELD_BACKUP_INTERVAL_HOURS", "24")), 720) * 3600)

    def maintain() -> None:
        next_cleanup = time.monotonic() + 86400
        next_backup = time.monotonic() + backup_interval_seconds
        while not server.maintenance_stop.wait(3600):
            now = time.monotonic()
            try:
                if now >= next_cleanup:
                    count = database.delete_expired_reports(REPORT_RETENTION_DAYS)
                    if count:
                        print(f"Scheduled retention cleanup removed {count} expired records.")
                    next_cleanup = now + 86400
                if backup_path is not None and now >= next_backup:
                    database.backup_to(backup_path)
                    print(f"Verified database backup updated at {backup_path}.")
                    next_backup = now + backup_interval_seconds
            except (sqlite3.Error, OSError, ValueError) as error:
                print(f"Scheduled maintenance failed: {error}")

    maintenance_thread = threading.Thread(target=maintain, name="scamshield-maintenance", daemon=True)
    maintenance_thread.start()
    print(f"ClearBeacon listening at http://{host}:{port} (Ctrl+C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping ClearBeacon.")
    finally:
        server.maintenance_stop.set()
        maintenance_thread.join(timeout=2)
        server.server_close()


if __name__ == "__main__":
    main()
