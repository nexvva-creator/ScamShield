from __future__ import annotations

from email import policy
from email.parser import Parser
from email.utils import getaddresses
import re
from urllib.parse import urlsplit


TRUSTED_ORGANIZATIONS = (
    {
        "name": "Federal Trade Commission — ReportFraud",
        "country": "United States",
        "domain": "reportfraud.ftc.gov",
        "url": "https://reportfraud.ftc.gov/",
        "catalogued_on": "2026-10-16",
        "source": "Official US Federal Trade Commission website",
    },
    {
        "name": "Canadian Anti-Fraud Centre",
        "country": "Canada",
        "domain": "antifraudcentre-centreantifraude.ca",
        "url": "https://antifraudcentre-centreantifraude.ca/",
        "catalogued_on": "2026-10-16",
        "source": "Official Government of Canada website",
    },
    {
        "name": "National Cyber Crime Reporting Portal",
        "country": "India",
        "domain": "cybercrime.gov.in",
        "url": "https://cybercrime.gov.in/",
        "catalogued_on": "2026-10-16",
        "source": "Official Government of India website",
    },
    {
        "name": "Cybermalveillance.gouv.fr",
        "country": "France",
        "domain": "cybermalveillance.gouv.fr",
        "url": "https://www.cybermalveillance.gouv.fr/",
        "catalogued_on": "2026-10-16",
        "source": "Official French government cyber-safety service",
    },
    {
        "name": "Bangladesh Police",
        "country": "Bangladesh",
        "domain": "police.gov.bd",
        "url": "https://www.police.gov.bd/en",
        "catalogued_on": "2026-10-16",
        "source": "Official Bangladesh Police website",
    },
    {
        "name": "GOV.UK — Report internet scams and phishing",
        "country": "United Kingdom",
        "domain": "gov.uk",
        "url": "https://www.gov.uk/report-suspicious-emails-websites-phishing",
        "catalogued_on": "2026-10-16",
        "source": "Official UK government guidance; reporting routes vary by nation and incident",
    },
    {
        "name": "Scamwatch — Australian Competition and Consumer Commission",
        "country": "Australia",
        "domain": "scamwatch.gov.au",
        "url": "https://www.scamwatch.gov.au/report-a-scam",
        "catalogued_on": "2026-10-16",
        "source": "Official Australian Government scam reporting service",
    },
    {
        "name": "INCIBE — Instituto Nacional de Ciberseguridad",
        "country": "Spain",
        "domain": "incibe.es",
        "url": "https://www.incibe.es/",
        "catalogued_on": "2026-10-16",
        "source": "Official Spanish cybersecurity institute; provides assistance and guidance",
    },
    {
        "name": "CERT-MX — Guardia Nacional",
        "country": "Mexico",
        "domain": "gob.mx",
        "url": "https://www.gob.mx/gncertmx",
        "catalogued_on": "2026-10-16",
        "source": "Official Mexican Government cyber incident response information",
    },
    {
        "name": "National Cyber Crime Investigation Agency (NCCIA)",
        "country": "Pakistan",
        "domain": "complaint.nccia.gov.pk",
        "url": "https://complaint.nccia.gov.pk/",
        "catalogued_on": "2026-10-16",
        "source": "Official Government of Pakistan cybercrime complaint portal",
    },
    {
        "name": "UAE Ministry of Interior — Report Cybercrimes",
        "country": "United Arab Emirates",
        "domain": "moi.gov.ae",
        "url": "https://www.moi.gov.ae/en/eservices/submit-cyber-crimes.aspx",
        "catalogued_on": "2026-10-16",
        "source": "Official UAE Ministry of Interior e-service",
    },
)


def check_email_headers(raw_headers: str) -> dict[str, object]:
    if not raw_headers.strip():
        raise ValueError("Paste email headers to check.")
    if len(raw_headers) > 12_000:
        raise ValueError("Email headers are too long (maximum 12,000 characters).")

    message = Parser(policy=policy.default).parsestr(raw_headers, headersonly=True)
    sender = message.get("From", "")
    reply_to = message.get("Reply-To", "")
    return_path = message.get("Return-Path", "")
    auth_results = message.get_all("Authentication-Results", [])

    def domain(value: str) -> str | None:
        parsed = getaddresses([value])
        if not parsed or "@" not in parsed[0][1]:
            return None
        return parsed[0][1].rsplit("@", 1)[1].strip(" >").lower().rstrip(".")

    sender_domain = domain(sender)
    reply_domain = domain(reply_to) if reply_to else None
    return_domain = domain(return_path) if return_path else None
    findings: list[str] = []
    if not sender_domain:
        findings.append("No usable From address was found in the pasted headers.")
    if reply_domain and sender_domain and reply_domain != sender_domain:
        findings.append("Reply-To uses a different domain from From; independently verify the sender.")
    if return_domain and sender_domain and return_domain != sender_domain:
        findings.append("Return-Path uses a different domain from From; forwarding can also cause this, so treat it as a clue only.")
    auth_text = " ".join(str(value) for value in auth_results).lower()
    for mechanism in ("spf", "dkim", "dmarc"):
        if f"{mechanism}=fail" in auth_text or f"{mechanism}=softfail" in auth_text:
            findings.append(f"The pasted Authentication-Results reports {mechanism.upper()} failure.")
        elif f"{mechanism}=pass" not in auth_text:
            findings.append(f"No {mechanism.upper()} pass result was visible in the pasted headers.")
    return {
        "sender_domain": sender_domain,
        "reply_to_domain": reply_domain,
        "return_path_domain": return_domain,
        "risk_label": "caution" if any("different domain" in finding or "failure" in finding for finding in findings) else "unknown",
        "findings": findings or ["No obvious mismatch was found in the supplied fields; this does not authenticate the email."],
        "disclaimer": "Header text can be forged or incomplete. This local check does not verify signatures, the sending server, or whether a message is genuine. Remove private email addresses before sharing headers.",
    }


def compare_organization_domain(value: str) -> dict[str, object]:
    host = value.strip()
    if "://" in host:
        host = urlsplit(host).hostname or ""
    else:
        host = urlsplit("//" + host).hostname or ""
    host = host.rstrip(".").lower()
    if not host or any(character.isspace() for character in host):
        raise ValueError("Enter a valid domain or web address.")
    matches = [
        organization for organization in TRUSTED_ORGANIZATIONS
        if host == organization["domain"] or host.endswith("." + organization["domain"])
    ]
    return {
        "domain": host,
        "matches": matches,
        "message": (
            "This host matches a domain in the ClearBeacon reference directory. Check the exact host and use a bookmark or address you already trust."
            if matches else
            "This host does not match a domain in the ClearBeacon reference directory. That alone does not prove it is fraudulent."
        ),
    }


def safety_checklist(scenario: str) -> list[str]:
    steps = {
        "payment": [
            "Pause; do not send money, gift cards, or cryptocurrency under pressure.",
            "Contact the bank or payment provider using its official app or a number you already trust.",
            "Verify the request independently with the person or organization.",
            "If you already paid, contact the provider promptly and preserve receipts and messages.",
        ],
        "job": [
            "Do not pay an upfront fee to obtain a job, training, equipment, or a background check.",
            "Verify the vacancy on the employer's official careers website.",
            "Contact the employer using independently sourced details, not the recruiter's links.",
            "Do not send identity documents until the employer and hiring process are verified.",
        ],
        "marketplace": [
            "Keep messages and payment on the platform where possible.",
            "Inspect the item in person when practical and avoid advance payment pressure.",
            "Check seller history and the platform's refund and buyer-protection terms.",
            "Do not use payment links or courier fees sent outside the platform.",
        ],
        "account": [
            "Never share a one-time code, password, or recovery phrase.",
            "Open the official service directly; do not follow an unexpected sign-in link.",
            "If credentials were shared, change them through the official site and revoke other sessions.",
            "Contact your bank or provider through a trusted channel if account access or money is at risk.",
        ],
    }
    if scenario not in steps:
        raise ValueError("Choose a supported safety checklist.")
    return steps[scenario]


def analyze_context_offer(kind: str, text: str) -> dict[str, object]:
    if kind not in {"job", "marketplace", "payment"}:
        raise ValueError("Choose job, marketplace, or payment.")
    if not text.strip() or len(text) > 6000:
        raise ValueError("Enter text between 1 and 6,000 characters.")
    patterns = {
        "job": (
            (r"\b(upfront|registration|training|equipment|processing)\s+fee\b", "An upfront fee is mentioned; legitimate employers generally do not require payment to obtain work."),
            (r"\b(guaranteed|easy)\s+(income|money|earnings)\b", "A guaranteed or unusually easy-income claim deserves independent verification."),
            (r"\b(whatsapp|telegram|signal)\b", "The conversation may be moving to a private channel; verify the employer through its official careers site."),
        ),
        "marketplace": (
            (r"\b(deposit|advance|shipping|courier)\s+(fee|payment)\b", "A separate advance or courier payment is mentioned; verify using the marketplace's own order page."),
            (r"\b(outside|off[- ]platform|another)\s+(the\s+)?(app|platform|payment)\b", "An off-platform transaction is mentioned; this can remove marketplace protections."),
            (r"\b(urgent|today only|act now)\b", "Urgency is mentioned; take time to inspect the seller and terms."),
        ),
        "payment": (
            (r"\b(gift cards?|crypto(?:currency)?|wire transfer)\b", "An irreversible payment method is mentioned; do not pay under pressure."),
            (r"\b(one[- ]time|verification)\s+code\b|\botp\b|\bpin\b", "A verification code or PIN is mentioned; never share it with a caller or seller."),
            (r"\b(urgent|immediately|account will be (?:blocked|closed))\b", "Urgency or a threat is mentioned; contact the organization through a trusted channel."),
        ),
    }
    findings = [message for expression, message in patterns[kind] if re.search(expression, text, re.IGNORECASE)]
    if not findings:
        findings.append("These local rules found no specific warning phrase. That does not establish that the offer or request is legitimate.")
    return {
        "kind": kind,
        "findings": findings,
        "risk_label": "caution" if len(findings) > 1 else "unknown",
        "checklist": safety_checklist("job" if kind == "job" else "marketplace" if kind == "marketplace" else "payment"),
        "disclaimer": "Illustrative local checks only; warning phrases are not proof, and missing phrases do not mean the offer is safe.",
    }
