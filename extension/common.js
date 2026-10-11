"use strict";

const SCAMSHIELD_API = "http://127.0.0.1:8000";

function isLikelyUrl(value) {
  const text = value.trim();
  return /^(?:https?:\/\/|www\.)/i.test(text) ||
    /^[a-z0-9.-]+\.[a-z]{2,}(?:[/?#].*)?$/i.test(text);
}

async function checkWithScamShield(value, type) {
  const isUrl = type === "url" || (type !== "message" && isLikelyUrl(value));
  const endpoint = isUrl ? "/api/check/url" : "/api/check/message";
  const body = isUrl ? { url: value } : { text: value };
  let response;
  try {
    response = await fetch(`${SCAMSHIELD_API}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Cannot reach ScamShield. Start the local app at http://127.0.0.1:8000 and try again.");
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("ScamShield returned an unreadable response. Check that the local app is running.");
  }
  if (!response.ok) {
    throw new Error(result.error || "ScamShield could not analyze this input.");
  }
  return result;
}
