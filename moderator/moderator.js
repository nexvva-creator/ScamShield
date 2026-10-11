"use strict";

const loginPanel = document.querySelector("#login-panel");
const dashboard = document.querySelector("#dashboard");
const loginForm = document.querySelector("#login-form");
const tokenInput = document.querySelector("#moderator-token");
const feedback = document.querySelector("#feedback");
const queue = document.querySelector("#queue");
const signOut = document.querySelector("#sign-out");
let adminToken = "";

function setFeedback(message, isError = false) {
  feedback.textContent = message;
  feedback.classList.toggle("error", isError);
  feedback.hidden = !message;
}

async function request(path, options = {}) {
  const apiBase = window.SCAMSHIELD_API_BASE_URL || "";
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "The request could not be completed.");
  return data;
}

function appendTextElement(parent, tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  parent.append(element);
  return element;
}

function renderReports(reports) {
  queue.replaceChildren();
  if (!reports.length) {
    appendTextElement(queue, "p", "empty", "No reports are waiting for review.");
    return;
  }

  for (const report of reports) {
    const card = document.createElement("article");
    card.className = "report";
    const heading = document.createElement("div");
    heading.className = "report-heading";
    appendTextElement(heading, "h3", "", report.category.replaceAll("_", " "));
    const date = document.createElement("time");
    date.dateTime = report.created_at;
    date.textContent = new Date(report.created_at).toLocaleString();
    heading.append(date);

    card.append(heading);
    appendTextElement(card, "p", "target", `Target: ${report.target || "(not provided)"}`);
    appendTextElement(card, "p", "summary", report.summary);
    const actions = document.createElement("div");
    actions.className = "report-actions";
    for (const [status, label] of [
      ["verified", "Mark verified"],
      ["rejected", "Reject"],
      ["escalated", "Escalate"],
    ]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary";
      button.textContent = label;
      button.addEventListener("click", () => void reviewReport(report.id, status, button));
      actions.append(button);
    }
    card.append(actions);
    queue.append(card);
  }
}

async function loadQueue() {
  setFeedback("Loading pending reports…");
  try {
    const data = await request("/api/admin/reports");
    renderReports(data.reports);
    setFeedback(`${data.reports.length} pending report(s).`);
  } catch (error) {
    if (error.message.includes("authorization")) {
      adminToken = "";
      loginPanel.hidden = false;
      dashboard.hidden = true;
      signOut.hidden = true;
      tokenInput.focus();
    }
    setFeedback(error.message || "The moderation queue could not be loaded.", true);
    throw error;
  }
}

async function reviewReport(id, status, button) {
  const reason = window.prompt(`Add a short reason for marking this report ${status}:`);
  if (!reason || !reason.trim()) return;
  button.disabled = true;
  try {
    await request(`/api/admin/reports/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, reason: reason.trim() }),
    });
    setFeedback("Review saved.");
    await loadQueue();
  } catch (error) {
    setFeedback(error.message || "The moderation action could not be saved.", true);
  } finally {
    button.disabled = false;
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  adminToken = tokenInput.value;
  tokenInput.value = "";
  try {
    await request("/api/admin/reports");
    loginPanel.hidden = true;
    dashboard.hidden = false;
    signOut.hidden = false;
    await loadQueue();
  } catch (error) {
    adminToken = "";
    setFeedback(error.message || "Sign-in failed.", true);
  }
});

document.querySelector("#refresh-queue").addEventListener("click", () => void loadQueue());
signOut.addEventListener("click", () => {
  adminToken = "";
  queue.replaceChildren();
  dashboard.hidden = true;
  loginPanel.hidden = false;
  signOut.hidden = true;
  setFeedback("Signed out.");
  tokenInput.focus();
});
