"use strict";

const input = document.querySelector("#check-input");
const checkButton = document.querySelector("#check-button");
const feedback = document.querySelector("#feedback");
const resultRegion = document.querySelector("#result");
const warningStatus = document.querySelector("#warning-status");
const warningToggle = document.querySelector("#warning-toggle");
let linkWarningsEnabled = false;

function setFeedback(message, isSuccess = false) {
  feedback.textContent = message;
  feedback.classList.toggle("success", isSuccess);
  feedback.hidden = !message;
}

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

function renderResult(data) {
  resultRegion.replaceChildren();
  if (data.error) {
    setFeedback(data.error);
    return;
  }
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
  setFeedback("", true);
}

async function analyze() {
  const value = input.value.trim();
  resultRegion.hidden = true;
  if (!value) {
    setFeedback("Paste a link or message first.");
    input.focus();
    return;
  }
  checkButton.disabled = true;
  setFeedback("Checking with the local ScamShield app…", true);
  try {
    renderResult(await checkWithScamShield(value));
  } catch (error) {
    setFeedback(error.message || "ScamShield could not analyze this input.");
  } finally {
    checkButton.disabled = false;
  }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || typeof tab.id !== "number") {
    throw new Error("Could not access the active tab.");
  }
  return tab;
}

document.querySelector("#page-button").addEventListener("click", async () => {
  try {
    const tab = await getActiveTab();
    if (!/^https?:\/\//i.test(tab.url || "")) {
      throw new Error("This page cannot be checked. Open a regular http or https page first.");
    }
    input.value = tab.url;
    void analyze();
  } catch (error) {
    setFeedback(error.message || "Could not read the active tab.");
  }
});

document.querySelector("#selection-button").addEventListener("click", async () => {
  try {
    const tab = await getActiveTab();
    const [selection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection()?.toString().trim() || "",
    });
    if (!selection || !selection.result) {
      throw new Error("Select some text on the page first, then try again.");
    }
    input.value = selection.result.slice(0, 6000);
    input.focus();
    setFeedback("Selected text added. Review it before checking.", true);
  } catch (error) {
    setFeedback(error.message || "Could not read selected text from this page.");
  }
});

checkButton.addEventListener("click", () => void analyze());
input.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") void analyze();
});

async function refreshWarningState() {
  const state = await chrome.storage.local.get("linkWarningsEnabled");
  linkWarningsEnabled = Boolean(state.linkWarningsEnabled);
  warningStatus.textContent = linkWarningsEnabled
    ? "On. Clicked links are checked locally before opening. Reload existing tabs to apply."
    : "Off. Nothing is monitored until you opt in.";
  warningToggle.textContent = linkWarningsEnabled ? "Turn off before-click warnings" : "Enable warnings on websites";
}

warningToggle.addEventListener("click", async () => {
  warningToggle.disabled = true;
  try {
    const enabled = !linkWarningsEnabled;
    if (enabled) {
      const granted = await chrome.permissions.request({
        origins: ["http://*/*", "https://*/*"],
      });
      if (!granted) {
        setFeedback("Website access was not granted. Link warnings remain off.");
        return;
      }
    }
    const response = await chrome.runtime.sendMessage({ type: "set-link-warnings", enabled });
    if (response?.error) throw new Error(response.error);
    if (!enabled) {
      await chrome.permissions.remove({ origins: ["http://*/*", "https://*/*"] });
    }
    await refreshWarningState();
    setFeedback(enabled
      ? "Warnings enabled. Reload open tabs to activate them."
      : "Warnings disabled and website access removed.", true);
  } catch (error) {
    setFeedback(error.message || "Could not update link warnings.");
  } finally {
    warningToggle.disabled = false;
  }
});

void refreshWarningState().catch(() => {
  warningStatus.textContent = "Could not read warning settings.";
});
