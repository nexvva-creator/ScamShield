"use strict";

function appendList(parent, title, items) {
  if (!items.length) return;
  const heading = document.createElement("h3");
  heading.textContent = title;
  const list = document.createElement("ul");
  for (const item of items) {
    const entry = document.createElement("li");
    entry.textContent = item;
    list.append(entry);
  }
  parent.append(heading, list);
}

async function loadContextResult() {
  const feedback = document.querySelector("#feedback");
  const resultRegion = document.querySelector("#result");
  const resultId = new URLSearchParams(location.search).get("id");
  if (!resultId || !/^[0-9a-f-]{36}$/i.test(resultId)) {
    feedback.textContent = "This result is missing or has expired. Run the check again.";
    return;
  }
  const key = `result-${resultId}`;
  const stored = await chrome.storage.session.get(key);
  await chrome.storage.session.remove(key);
  const data = stored[key];
  if (!data) {
    feedback.textContent = "This result has expired. Run the check again.";
    return;
  }
  if (data.error) {
    feedback.textContent = data.error;
    return;
  }

  feedback.hidden = true;
  const heading = document.createElement("h2");
  heading.textContent = data.title || "Unable to determine";
  const intro = document.createElement("p");
  intro.textContent = data.risk_label === "unknown"
    ? "Available local checks could not make a reliable determination."
    : "This is a risk signal, not proof of fraud.";
  const score = document.createElement("div");
  score.className = "score";
  const scoreValue = Number.isFinite(data.score) ? Math.max(0, Math.min(100, data.score)) : 0;
  score.textContent = `Risk signal: ${scoreValue}/100`;
  const meter = document.createElement("div");
  meter.className = "meter";
  meter.setAttribute("role", "meter");
  meter.setAttribute("aria-label", "Risk signal");
  meter.setAttribute("aria-valuemin", "0");
  meter.setAttribute("aria-valuemax", "100");
  meter.setAttribute("aria-valuenow", String(scoreValue));
  const fill = document.createElement("span");
  fill.style.width = `${scoreValue}%`;
  meter.append(fill);
  resultRegion.append(heading, intro, score, meter);
  appendList(resultRegion, "What we noticed", (data.evidence || []).map((item) => item.text));
  appendList(resultRegion, "Safer next steps", data.recommended_actions || []);
  const disclaimer = document.createElement("p");
  disclaimer.textContent = data.disclaimer || "This is guidance, not a security guarantee.";
  resultRegion.append(disclaimer);
  resultRegion.hidden = false;
}

loadContextResult().catch(() => {
  const feedback = document.querySelector("#feedback");
  feedback.textContent = "The temporary result could not be loaded. Run the check again.";
});
