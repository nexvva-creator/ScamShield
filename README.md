# ScamShield

A privacy-first, mobile-friendly anti-scam decision-support MVP based on the workspace product blueprint. The app checks pasted URLs and messages, explains local-rule signals, accepts private scam reports, and provides token-protected moderation.

> ScamShield is an independent educational project, not a government service or a security guarantee. The Singapore public service already uses the ScamShield name; do not imply affiliation, and complete name/domain/trademark clearance before public release.

## Run locally

Requires Python 3.10+. Local SQLite mode uses the Python standard library; PostgreSQL deployments install the driver from `requirements.txt`.

```powershell
cd F:\scamshield
$env:SCAMSHIELD_ADMIN_TOKEN = "choose-a-long-random-local-token"
python server.py
```

Open <http://127.0.0.1:8000>. Stop with Ctrl+C. The default listener is loopback-only. Reports are stored in `data\scamshield.sqlite3`; pasted checks are analyzed in memory and not retained. Set `SCAMSHIELD_DB` to use a different SQLite path. For a classroom demo only, set `SCAMSHIELD_HOST` or `SCAMSHIELD_PORT` to override the bind address or port. Do not expose this development server to the public internet.

## Pilot deployment (Vercel + Render)

The Vercel project serves the static website, the Render Free web service runs the Python API, and a managed PostgreSQL provider (for example, a Supabase free-tier project) stores reports. `vercel.json` and `render.yaml` contain the deployment configuration. Free-tier availability, sleep/pause behavior, quotas, backups and prices can change; verify the providers' current terms before inviting users.

1. Push this project to a GitHub repository you control. Do not commit `.env` files, database files, or moderator/database credentials.
2. Create a managed PostgreSQL project and copy its server-side connection URI. Use the provider's connection-pooler URI if required for IPv4/serverless environments, and require TLS (`sslmode=require`). Keep the URI private; never place it in Vercel variables or browser code.
3. In Render, create a Blueprint from that repository and deploy `render.yaml`. Set `DATABASE_URL` to the PostgreSQL URI in Render's private environment settings. The service intentionally refuses to start without this value, instead of silently storing reports on Render's temporary filesystem. Render generates `SCAMSHIELD_ADMIN_TOKEN` for moderator access.
4. After Render gives the API its HTTPS URL, create a Vercel project from the same repository. Keep the project root at the repository root and set `SCAMSHIELD_API_BASE_URL` to the Render HTTPS origin, for example `https://scamshield-api.example.onrender.com` (no path). Vercel uses the included `vercel.json` build command to publish `public/` and the moderator page.
5. After Vercel assigns the site's domain, set Render's `SCAMSHIELD_ALLOWED_ORIGINS` to the exact Vercel origin, such as `https://your-project.vercel.app` (no trailing slash). Add any custom production domain explicitly. Do not use `*`. Redeploy the Render service after changing the variable.
6. Verify `https://<render-service>/api/health`, then test a link check, message check, report submission, and report-status lookup on the Vercel site. Test moderator access separately at `/moderator`; retrieve the generated token from Render's private environment settings and never put it in Vercel or browser code.

The static Vercel build intentionally fails if `SCAMSHIELD_API_BASE_URL` is missing or is not an HTTPS origin. Cross-origin API access is limited to origins listed by `SCAMSHIELD_ALLOWED_ORIGINS`. The public browser extension is still configured for localhost and is not ready for store distribution against the hosted API.

On Render's free plan, the API can spin down while idle, so its first request may be slow. PostgreSQL keeps report data separate from Render's ephemeral filesystem, but free database plans may pause, impose quotas, and have limited backup/availability guarantees. Check provider status and maintain tested backups before relying on reports.

This is a hosted pilot, not a production security guarantee. The analyzer still uses illustrative local rules and has no live reputation feed or accuracy benchmark. The moderator token is not a full identity system; do not collect highly sensitive reports from the public until access controls, retention/deletion, backups, monitoring and abuse defenses are reviewed. ScamShield must not claim perfect scam detection or guarantee that a link is safe.

## What works in this MVP

- URL checks: validates HTTP(S) inputs, blocks local/private/reserved IP addresses, and highlights explainable lexical signals. The server never opens or fetches submitted URLs.
- Recent checks: keeps up to ten result summaries in browser storage on the user's device. It does not save the original URL or message and does not upload history. Users can reopen a result or clear the local history; saved evidence remains in the language used for that check.
- Safety response planner: gives practical next steps for shared passwords or codes, payments, suspicious links, and remote-access apps. It does not ask users to disclose the incident details.
- Official-help directory: links to the FTC (United States), Canadian Anti-Fraud Centre, India's National Cyber Crime Reporting Portal, and France's Cybermalveillance.gouv.fr. Coverage is limited; links open the agencies' official websites, and urgent financial losses should be reported to the user's bank promptly.
- Scam-awareness quiz: three short scenarios test safer choices in a single browser session. Answers and scores are not sent or saved.
- Language switching: the interface, guide library, check results, explanations, actions, and disclaimer support English (`en`), Spanish (`es`), French (`fr`), Hindi (`hi`), and Arabic (`ar`). The browser's preferred supported language is selected on first visit; a manual choice is saved in that browser. Arabic uses a right-to-left layout.
- Message checks: local illustrative phrase rules cover OTP/PIN requests, urgency, delivery/release fees, unexpected prizes, job offers, identity-data requests, link-pushing, and unrealistic returns. Whole-word matching avoids substring hits such as `pin` inside “shipping,” and explicit English security reminders not to share codes are excluded from the secret-request rule. English has broader phrase coverage; Spanish, French, Hindi, and Arabic include representative phrases, not comprehensive national-language detection. Curated regression examples exercise delivery-fee, account-link, credential, job-fee, and recovery-scam wording alongside benign shipping and security reminders; this is a behavior regression set, not an accuracy benchmark. Extracted link hostnames are never visited.
- Screenshot review: uploads can be previewed locally and text can be extracted with browser-side OCR when available, then analyzed with the same message rules; the image stays on-device and the extracted text is not saved or sent to an outside service.
- Chromium browser extension: the popup checks pasted links/messages, the active page, or selected text; right-click actions check a link or selected text. Optional before-click warnings require a separate, explicit grant of access to websites; only ordinary clicked HTTP(S) links are paused and checked with the local app. Links are not opened automatically or sent to a third party.
- Private moderator dashboard: removed from the public navigation and main page, served separately at `/moderator`, and marked `noindex`. The dashboard requires the configured moderator token for every queue/review API action; report data is not returned without authorization.
- Safety library: eight searchable, category-filtered guides cover account codes, urgent payments, job fees, unfamiliar shops, links, prizes, and recovery steps. Guide titles, summaries, and next steps are available in all five interface languages.
- Honest uncertainty: there is no live threat-intelligence integration; when local rules find no strong signal, the result is **Unable to determine**, never “safe”.
- Private reports: submissions start pending, are not exposed publicly, and can be checked using a random private reference.
- Moderation: pending reports can be reviewed as verified, rejected or escalated with a recorded reason. Configure `SCAMSHIELD_ADMIN_TOKEN`; it is held in server configuration, compared in constant time, and never logged.
- Mobile-responsive, keyboard-usable interface, accessible live announcements, CSP/security headers, bounded request sizes and basic per-IP request throttling.

## API

- `GET /api/health`
- `POST /api/check/url` — `{"url":"https://example.org","locale":"en"}` (`locale` may be `en`, `es`, `fr`, `hi`, or `ar`; defaults to English)
- `POST /api/check/message` — `{"text":"Suspicious message...","locale":"es"}` (same supported locales)
- `POST /api/check/screenshot` — `{"text":"Text extracted from a screenshot...","locale":"en"}` (same supported locales; used for browser-side OCR review flows)
- `POST /api/reports` — `{"category":"job","target":"example.org","summary":"..."}`
- `POST /api/reports/status` — `{"token":"private-reference"}`
- `GET /api/admin/reports` — `Authorization: Bearer <SCAMSHIELD_ADMIN_TOKEN>`
- `PATCH /api/admin/reports/{id}` — same authorization; `{"status":"verified","reason":"..."}`

## Browser extension (Chrome and Edge)

1. Start ScamShield locally with `python server.py`; the extension connects to `http://127.0.0.1:8000`.
2. Open `chrome://extensions` (or `edge://extensions`) and enable **Developer mode**.
3. Choose **Load unpacked** and select the workspace's `extension` folder.
4. Use the ScamShield toolbar button to check pasted text, the active page, or text selected on the current page. You can also right-click a link or selected text and choose its ScamShield check action.
5. Before-click warnings are off by default. In the popup, choose **Enable warnings on websites** and grant the browser's optional site-access permission. Reload open tabs to apply. Ordinary link clicks will pause while the local API checks the URL, then present a choice to stay or continue; modifiers, downloads, and non-web links are not intercepted. Disable the option to unregister the listener and revoke website access.

The extension requests only active-tab access, scripting for user-triggered capture, context menus, temporary storage, and access to the local ScamShield API by default. Broad website access is requested only after opting in and can be revoked from the popup. A warning is not a block: users can choose to continue. Its local-rule verdict is decision support, not a security guarantee. The extension currently expects the default local address and port.

## Private moderator dashboard

The public homepage contains no moderator link or controls. Start the server with `SCAMSHIELD_ADMIN_TOKEN` configured, then open <http://127.0.0.1:8000/moderator> directly. This route is not linked from the public site and sends `X-Robots-Tag: noindex, nofollow, noarchive`; the token is held in page memory only and is required by the protected moderation APIs. This lightweight dashboard is suitable for a local pilot, not public deployment—use HTTPS and a proper identity provider before hosting it beyond loopback.

## Research translated into product decisions

The supplied competitor-research blueprint recommends a guest-first checker, URL and message inputs, explained evidence, cautious language, reporting and moderation before OCR or machine learning. Its desk research identifies different existing products across scam checking, threat feeds and reporting; it cautions that this is documentary comparison, not hands-on competitor testing. It also warns that some external APIs have non-commercial limits, quotas, or sharing restrictions. Accordingly, this MVP does not send submitted URLs/messages to third parties or claim live reputation results.

Primary references to re-check before adding integrations:

- [Google Safe Browsing API reference](https://developers.google.com/safe-browsing/reference) — API behavior, freshness and privacy details; verify current eligibility and use terms before a production integration.
- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) — rationale for never fetching arbitrary user-provided links.
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) — relevant before adding screenshot/OCR upload.
- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) — accessibility target for the public interface.
- Google Safe Browsing, VirusTotal, urlscan.io, PhishTank and OpenPhish are not interchangeable drop-in services; terms, availability, disclosure behavior, attribution, licensing and quotas must be checked individually.

## Important limitations and next steps

The local rules are demonstration heuristics, not an independently evaluated classifier and not a calibrated probability. A keyword match can be a false positive. There is no external threat feed, DNS lookup, URL content fetch, account system, CAPTCHA, automatic email/SMS blocking, ML, production-grade distributed rate limit, CSRF token, TLS termination or retention-deletion scheduler. The moderator token is a simple pilot gate, not a complete production identity system. Reports should stay private pending a trained human reviewer. Before public deployment, add HTTPS behind a maintained production server, formal authentication/authorization, abuse controls, retention policy, migrations/backups, audit access controls, operational monitoring, regional legal review, security testing and a measured holdout evaluation.

## Tests

```powershell
python -m unittest discover -s tests -v
```

The browser script can also be syntax-checked with `node --check public\app.js`.
