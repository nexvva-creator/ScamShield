"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist");
const apiBaseUrl = process.env.SCAMSHIELD_API_BASE_URL;

if (!apiBaseUrl) {
  throw new Error("Set SCAMSHIELD_API_BASE_URL to the deployed HTTPS Render API URL.");
}

let parsedApiUrl;
try {
  parsedApiUrl = new URL(apiBaseUrl);
} catch {
  throw new Error("SCAMSHIELD_API_BASE_URL must be a valid HTTPS URL.");
}
if (parsedApiUrl.protocol !== "https:" || parsedApiUrl.pathname !== "/" || parsedApiUrl.search || parsedApiUrl.hash) {
  throw new Error("SCAMSHIELD_API_BASE_URL must be an HTTPS origin without a path, query, or fragment.");
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
fs.cpSync(path.join(root, "public"), output, { recursive: true });
fs.mkdirSync(path.join(output, "moderator"), { recursive: true });
fs.cpSync(path.join(root, "moderator"), path.join(output, "moderator"), { recursive: true });
const contentSecurityPolicy = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' https://cdn.jsdelivr.net",
  "img-src 'self' data: blob: https:",
  `connect-src 'self' https://cdn.jsdelivr.net ${parsedApiUrl.origin}`,
  "media-src 'self' blob: data:",
  "worker-src 'self' blob: https://cdn.jsdelivr.net",
  "base-uri 'none'",
  "form-action 'self'",
].join("; ");
for (const htmlPath of [
  path.join(output, "index.html"),
  path.join(output, "moderator", "index.html"),
]) {
  const html = fs.readFileSync(htmlPath, "utf8");
  fs.writeFileSync(
    htmlPath,
    html.replace("</head>", `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy}">\n</head>`),
    "utf8",
  );
}
fs.writeFileSync(
  path.join(output, "config.js"),
  `"use strict";\n\nwindow.SCAMSHIELD_API_BASE_URL = ${JSON.stringify(parsedApiUrl.origin)};\n`,
  "utf8",
);
