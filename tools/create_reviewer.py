from __future__ import annotations

import getpass
import hashlib
import json
import secrets
import base64
from urllib.parse import quote


ITERATIONS = 310_000


def main() -> None:
    username = input("Reviewer username: ").strip()
    role = input("Role (admin/reviewer): ").strip().lower()
    if not username or len(username) > 120 or role not in {"admin", "reviewer"}:
        raise SystemExit("Enter a username (max 120 characters) and role admin or reviewer.")
    password = getpass.getpass("Password (minimum 14 characters): ")
    if len(password) < 14:
        raise SystemExit("Password must be at least 14 characters.")
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), ITERATIONS).hex()
    account = {"salt": salt, "password_hash": digest, "role": role}
    if input("Enable TOTP authenticator MFA? [y/N]: ").strip().lower() in {"y", "yes"}:
        secret = base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")
        account["totp_secret"] = secret
        print(f"Add this secret to an authenticator app: {secret}")
        print(f"Provisioning URI: otpauth://totp/ClearBeacon:{quote(username, safe='')}?secret={secret}&issuer=ClearBeacon&digits=6&period=30")
        print("Store the secret securely; ClearBeacon does not retain recovery codes.")
    print(json.dumps({username: account}))
    print("Set SCAMSHIELD_REVIEWERS to the JSON object above. Keep it out of source control.")


if __name__ == "__main__":
    main()
