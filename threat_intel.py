from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


MAX_FEED_BYTES = 2_000_000
MAX_FEED_AGE_DAYS = 14


def validate_feed_payload(payload: object) -> str | None:
    if not isinstance(payload, dict) or not isinstance(payload.get("domains"), list):
        return "Feed must be a JSON object with a domains array."
    domains = payload["domains"]
    if len(domains) > 100_000:
        return "Feed can contain at most 100,000 domains."
    for domain in domains:
        if (not isinstance(domain, str) or len(domain) > 253 or
                not domain.strip() or domain != domain.strip() or
                domain.endswith("..") or
                any(not label or len(label) > 63 or label.startswith("-") or label.endswith("-")
                    for label in domain.rstrip(".").split(".")) or
                any(not (char.isalnum() or char in ".-") for char in domain)):
            return "Each feed entry must be a plain domain name (maximum 253 characters)."
    provider = payload.get("provider", "local_file")
    if (not isinstance(provider, str) or not provider.strip() or len(provider) > 80 or
            any(ord(char) < 32 for char in provider)):
        return "Feed provider must be a non-empty label of at most 80 characters."
    try:
        updated = datetime.fromisoformat(str(payload.get("updated_at", "")).replace("Z", "+00:00"))
        if updated.tzinfo is None:
            raise ValueError("timezone required")
        age_days = (datetime.now(timezone.utc) - updated.astimezone(timezone.utc)).total_seconds() / 86400
    except (ValueError, TypeError):
        return "Feed updated_at must be a valid timestamp with a timezone."
    if age_days < -1:
        return "Feed timestamp is in the future."
    if age_days > MAX_FEED_AGE_DAYS:
        return f"Feed is stale; it must be updated within {MAX_FEED_AGE_DAYS} days."
    return None


def match_feed_payload(host: str, payload: object) -> dict[str, Any]:
    error = validate_feed_payload(payload)
    if error:
        if error.startswith("Feed is stale;") and isinstance(payload, dict):
            return {
                "status": "stale",
                "provider": str(payload.get("provider", "local_file"))[:80],
                "updated_at": str(payload.get("updated_at")),
                "match": False,
            }
        return {
            "status": "unavailable", "provider": "local_file", "updated_at": None,
            "match": False, "error": error,
        }
    assert isinstance(payload, dict)
    updated_at = str(payload["updated_at"])
    return {
        "status": "completed",
        "provider": str(payload.get("provider", "local_file"))[:80],
        "updated_at": updated_at,
        "match": host.lower().rstrip(".") in {domain.lower().rstrip(".") for domain in payload["domains"]},
    }


def match_local_feed(host: str, path: str | None, payload_json: str | None = None) -> dict[str, Any]:
    if payload_json is not None:
        try:
            payload = json.loads(payload_json)
        except json.JSONDecodeError:
            return {"status": "unavailable", "provider": "database", "updated_at": None,
                    "match": False, "error": "Active threat feed could not be parsed."}
        return match_feed_payload(host, payload)
    if not path:
        return {"status": "not_configured", "provider": None, "updated_at": None, "match": False}
    feed_path = Path(path)
    try:
        if feed_path.stat().st_size > MAX_FEED_BYTES:
            raise ValueError("Threat feed exceeds the 2 MB limit.")
        payload = json.loads(feed_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError):
        return {
            "status": "unavailable",
            "provider": "local_file",
            "updated_at": None,
            "match": False,
            "error": "Configured threat feed could not be read or parsed.",
        }
    return match_feed_payload(host, payload)


def apply_threat_result(result: dict[str, Any], reputation: dict[str, Any]) -> dict[str, Any]:
    entry = {
        "check": "threat_intelligence",
        "status": reputation["status"],
        "provider": reputation.get("provider"),
        "updated_at": reputation.get("updated_at"),
    }
    result["coverage"] = [result["coverage"][0], entry]
    if reputation["match"]:
        result["risk_label"] = "known_malicious"
        result["title"] = "Known malicious match"
        result["score"] = 100
        result["evidence"].insert(0, {
            "type": "known_threat_feed_match",
            "text": f"This domain appears in the configured threat list ({reputation['provider']}).",
            "strength": "strong",
            "source": reputation["provider"],
        })
        result["decision_reason"].insert(0, result["evidence"][0]["text"])
        result["recommended_actions"] = ["Do not open the link or send money.", "Report the message to the service that sent it."]
        result["disclaimer"] = "A threat-list match is a warning based on this feed and is not a legal finding."
    if reputation.get("error"):
        result["feed_error"] = reputation["error"]
    return result
