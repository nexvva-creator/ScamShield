"use strict";

const $ = (selector, root = document) => root.querySelector(selector);
let adminToken = "";
let reports = [];
let adminRole = "";
let pageOffset = 0;
let pageHasMore = false;
let sessionTimer = null;
let adminActionsBound = false;

function feedback(element, message, kind = "") {
  element.textContent = message;
  element.className = `feedback${kind ? ` ${kind}` : ""}`;
  element.hidden = false;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("The server returned an unreadable response.");
  }
  if (!response.ok) throw new Error(payload.error || "The request could not be completed.");
  return payload;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function visibleReports() {
  const query = $("#report-search").value.trim().toLocaleLowerCase();
  return reports.filter((report) =>
    `${report.category} ${report.target} ${report.summary} ${report.status}`.toLocaleLowerCase().includes(query),
  );
}

function renderReports() {
  const list = $("#report-list");
  list.replaceChildren();
  const filtered = visibleReports();
  if (!filtered.length) {
    list.append(element("p", "admin-empty", "No reports match this view."));
    return;
  }
  for (const report of filtered) {
    const card = element("article", "admin-record");
    if (adminRole === "admin" && report.status === "pending") {
      const selectReport = element("input");
      selectReport.type = "checkbox";
      selectReport.className = "report-select";
      selectReport.value = report.id;
      selectReport.setAttribute("aria-label", "Select report for bulk review");
      card.append(selectReport);
    }
    const heading = element("div", "admin-record-heading");
    heading.append(element("h3", "", `${report.category.replaceAll("_", " ")} · ${report.status}`));
    heading.append(element("time", "", formatDate(report.created_at)));
    const details = element("p", "admin-record-target", report.target);
    const summary = element("p", "admin-record-copy", report.summary);
    card.append(heading, details, summary);
    if (report.evidence_notes) card.append(element("p", "admin-record-copy", `Evidence notes: ${report.evidence_notes}`));
    card.append(element("p", "admin-record-copy", `Channel: ${report.contact_channel} · Incident date: ${report.incident_date || "not provided"} · Language: ${report.locale}`));
    const casework = element("details", "casework-details");
    casework.append(element("summary", "", "Private notes and reporter follow-up"));
    const clarificationHistory = element("div", "case-notes");
    clarificationHistory.append(element("h4", "", "Private clarification history"));
    const clarificationList = element("div", "case-note-list");
    clarificationHistory.append(clarificationList);
    const notes = element("div", "case-notes");
    const notesTitle = element("h4", "", "Private case notes and handoffs");
    const noteList = element("div", "case-note-list");
    const noteForm = element("form", "case-note-form");
    const kind = element("select");
    kind.setAttribute("aria-label", "Note type");
    for (const [value, label] of [["note", "Private note"], ["handoff", "Reviewer handoff"]]) {
      const option = element("option", "", label);
      option.value = value;
      kind.append(option);
    }
    const content = element("textarea");
    content.rows = 2;
    content.maxLength = 2000;
    content.required = true;
    content.placeholder = "Private reviewer note (not visible to the reporter)";
    const saveNote = element("button", "secondary-button", "Save note");
    saveNote.type = "submit";
    noteForm.append(kind, content, saveNote);
    noteForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      saveNote.disabled = true;
      try {
        await api(`/api/admin/reports/${report.id}/notes`, {
          method: "PATCH",
          body: JSON.stringify({ kind: kind.value, content: content.value.trim() }),
        });
        content.value = "";
        await loadCaseNotes(report.id, noteList);
      } catch (error) {
        feedback($("#dashboard-feedback"), error.message, "error");
      } finally {
        saveNote.disabled = false;
      }
    });
    notes.append(notesTitle, noteList, noteForm);
    casework.append(clarificationHistory, notes);
    const clarificationForm = element("form", "review-form");
    const clarificationLabel = element("label", "", "Ask the reporter for more details");
    const clarificationMessage = element("textarea");
    clarificationMessage.rows = 2;
    clarificationMessage.maxLength = 1000;
    clarificationMessage.required = true;
    clarificationMessage.minLength = 12;
    clarificationMessage.placeholder = "Do not ask for passwords, codes, or identity documents.";
    clarificationMessage.setAttribute("aria-label", "Clarification request to reporter");
    clarificationLabel.append(clarificationMessage);
    const ask = element("button", "secondary-button", "Send private clarification");
    ask.type = "submit";
    clarificationForm.append(clarificationLabel, ask);
    clarificationForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      ask.disabled = true;
      try {
        await api("/api/admin/clarifications", {
          method: "POST",
          body: JSON.stringify({ report_id: report.id, message: clarificationMessage.value.trim() }),
        });
        clarificationMessage.value = "";
        feedback($("#dashboard-feedback"), "Private clarification request sent.", "success");
      } catch (error) {
        feedback($("#dashboard-feedback"), error.message, "error");
      } finally {
        ask.disabled = false;
      }
    });
    casework.append(clarificationForm);
    let caseworkLoaded = false;
    casework.addEventListener("toggle", async () => {
      if (!casework.open || caseworkLoaded) return;
      const results = await Promise.allSettled([
        loadCaseClarifications(report.id, clarificationList),
        loadCaseNotes(report.id, noteList),
      ]);
      if (results[0].status === "rejected") clarificationList.textContent = results[0].reason.message;
      if (results[1].status === "rejected") noteList.textContent = results[1].reason.message;
      caseworkLoaded = results.every((result) => result.status === "fulfilled");
    });
    card.append(casework);
    if (report.duplicate_of) {
      card.append(element("p", "duplicate-hint", `Possible duplicate: related report ${report.duplicate_of.slice(0, 8)}. Review manually; reports have not been merged.`));
    }
    if (report.status === "pending") {
      const review = element("form", "review-form");
      const decisionLabel = element("label", "", "Decision");
      const decision = element("select");
      decision.setAttribute("aria-label", "Decision");
      for (const [value, label] of [["verified", "Verify report"], ["rejected", "Reject report"], ["escalated", "Escalate report"]]) {
        const option = element("option", "", label);
        option.value = value;
        decision.append(option);
      }
      decisionLabel.append(decision);
      const reason = element("input");
      reason.required = true;
      reason.maxLength = 1000;
      reason.placeholder = "Required reason for this action";
      reason.setAttribute("aria-label", "Reason for review decision");
      const template = element("select");
      template.setAttribute("aria-label", "Reason template");
      for (const [value, label] of [
        ["", "Choose a review template (optional)"],
        ["Evidence was checked against an independently verified source.", "Verified: independent source"],
        ["Available details do not sufficiently support this report.", "Reject: insufficient details"],
        ["This report needs a specialist or additional review.", "Escalate: specialist review"],
      ]) {
        const option = element("option", "", label);
        option.value = value;
        template.append(option);
      }
      template.addEventListener("change", () => { if (template.value) reason.value = template.value; });
      const submit = element("button", "secondary-button", "Record decision");
      submit.type = "submit";
      review.append(decisionLabel, template, reason, submit);
      review.addEventListener("submit", async (event) => {
        event.preventDefault();
        submit.disabled = true;
        try {
          await api(`/api/admin/reports/${report.id}`, {
            method: "PATCH",
            body: JSON.stringify({ status: decision.value, reason: reason.value.trim() }),
          });
          await loadDashboard();
          feedback($("#dashboard-feedback"), "Report decision recorded.", "success");
        } catch (error) {
          feedback($("#dashboard-feedback"), error.message, "error");
          submit.disabled = false;
        }
      });
      card.append(review);
      if (adminRole === "admin") {
        const assignment = element("form", "assignment-form");
        const reviewer = element("input");
        reviewer.maxLength = 120;
        reviewer.placeholder = report.assigned_to ? `Assigned: ${report.assigned_to}` : "Reviewer username";
        reviewer.setAttribute("aria-label", "Assign report to reviewer");
        const assignmentReason = element("input");
        assignmentReason.required = true;
        assignmentReason.maxLength = 1000;
        assignmentReason.placeholder = "Reason for assignment";
        assignmentReason.setAttribute("aria-label", "Reason for assignment");
        const assign = element("button", "secondary-button", "Assign reviewer");
        assign.type = "submit";
        assignment.append(reviewer, assignmentReason, assign);
        assignment.addEventListener("submit", async (event) => {
          event.preventDefault();
          assign.disabled = true;
          try {
            await api("/api/admin/reports/assign", {
              method: "PATCH",
              body: JSON.stringify({ report_id: report.id, reviewer: reviewer.value.trim(), reason: assignmentReason.value.trim(), status: "assigned" }),
            });
            await loadDashboard();
          } catch (error) {
            feedback($("#dashboard-feedback"), error.message, "error");
            assign.disabled = false;
          }
        });
        card.append(assignment);
      }
    }
    list.append(card);
  }
}

async function loadCaseNotes(reportId, target) {
  const result = await api(`/api/admin/reports/${reportId}/notes`);
  target.replaceChildren();
  if (!result.notes.length) {
    target.append(element("p", "admin-empty", "No private notes yet."));
    return;
  }
  for (const note of result.notes) {
    target.append(element("p", "admin-record-copy", `${note.kind === "handoff" ? "Handoff" : "Private note"} · ${note.author} · ${formatDate(note.created_at)}: ${note.content}`));
  }
}

async function loadCaseClarifications(reportId, target) {
  const result = await api(`/api/admin/reports/${reportId}/clarifications`);
  target.replaceChildren();
  if (!result.clarifications.length) {
    target.append(element("p", "admin-empty", "No clarification requests."));
    return;
  }
  for (const item of result.clarifications) {
    target.append(element("p", "admin-record-copy", `Request · ${item.author} · ${formatDate(item.created_at)} · ${item.status}: ${item.request}`));
    if (item.reply) target.append(element("p", "admin-record-copy", `Reporter reply · ${formatDate(item.updated_at)}: ${item.reply}`));
  }
}

function renderOperations(operations) {
  const container = $("#operations-summary");
  container.replaceChildren();
  container.append(
    element("p", "admin-record-copy", `Status: ${operations.status} · Pending reports: ${operations.pending_reports} · Oldest pending: ${operations.oldest_pending_age_hours ?? "none"} hours · Alert threshold: ${operations.queue_alert_threshold_hours} hours`),
    element("p", "admin-record-copy", `Database: ${(operations.database_size_bytes / (1024 * 1024)).toFixed(2)} MiB · Pending feedback: ${operations.pending_feedback} · Retention: ${operations.report_retention_days} days · Uptime: ${operations.uptime_seconds} seconds`),
  );
  if (operations.backup) {
    const backup = operations.backup;
    container.append(element(
      "p", "admin-record-copy",
      `Automated backup: ${backup.configured ? (backup.exists ? `last completed ${backup.age_hours} hours ago` : "configured; awaiting first completed run") : "not configured"} · Interval: ${backup.interval_hours} hours`,
    ));
  }
  if (operations.reviewer_workloads?.length) {
    container.append(element("h3", "", "Assigned reviewer workload"));
    for (const workload of operations.reviewer_workloads) {
      container.append(element(
        "p", "admin-record-copy",
        `${workload.reviewer}: ${workload.pending_reports} pending · oldest ${workload.oldest_pending_age_hours} hours`,
      ));
    }
  }
  for (const alert of operations.alerts) container.append(element("p", "operations-alert", alert.message));
  if (!operations.alerts.length) container.append(element("p", "admin-empty", "No operational alerts."));
}

function renderThreatFeeds(data) {
  const list = $("#feed-versions");
  list.replaceChildren();
  if (data.configured_local_file) {
    list.append(element("p", "admin-record-copy", "A local file feed is configured. The active staged database feed takes precedence."));
  }
  if (!data.versions.length) {
    list.append(element("p", "admin-empty", "No staged feed versions."));
    return;
  }
  for (const version of data.versions) {
    const row = element("article", "admin-record");
    row.append(
      element("h3", "", `${version.provider} · ${version.status}`),
      element("p", "admin-record-copy", `Feed timestamp: ${version.updated_at} · Staged: ${formatDate(version.created_at)}${version.activated_at ? ` · Activated: ${formatDate(version.activated_at)}` : ""}`),
    );
    if (version.status === "staged") {
      const activate = element("button", "secondary-button", "Activate this version");
      activate.type = "button";
      activate.addEventListener("click", async () => {
        activate.disabled = true;
        try {
          await api("/api/admin/feed/activate", {
            method: "PUT",
            body: JSON.stringify({ id: version.id }),
          });
          await loadDashboard();
          feedback($("#feed-feedback"), "Threat-feed version activated.", "success");
        } catch (error) {
          feedback($("#feed-feedback"), error.message, "error");
          activate.disabled = false;
        }
      });
      row.append(activate);
    }
    list.append(row);
  }
}

function renderSessions(data) {
  const list = $("#session-list");
  list.replaceChildren();
  if (!data.sessions.length) {
    list.append(element("p", "admin-empty", "No active named-account sessions."));
    return;
  }
  for (const session of data.sessions) {
    list.append(element("p", "admin-record-copy", `${session.username} · ${session.role} · expires in ${Math.ceil(session.expires_in / 60)} minutes`));
  }
}

function renderAppeals(appeals) {
  const list = $("#appeal-list");
  list.replaceChildren();
  if (!appeals.length) {
    list.append(element("p", "admin-empty", "No appeals are awaiting review."));
    return;
  }
  for (const appeal of appeals) {
    const card = element("article", "admin-record");
    card.append(
      element("h3", "", `${appeal.category.replaceAll("_", " ")} · current status: ${appeal.report_status}`),
      element("p", "admin-record-target", appeal.target),
      element("p", "admin-record-copy", appeal.details),
      element("p", "admin-record-copy", `Original report: ${appeal.summary}`),
      ...(appeal.evidence_notes ? [element("p", "admin-record-copy", `Evidence notes: ${appeal.evidence_notes}`)] : []),
      element("time", "", formatDate(appeal.created_at)),
    );
    const reason = element("textarea");
    reason.required = true;
    reason.maxLength = 1000;
    reason.rows = 2;
    reason.placeholder = "Required reason for this appeal decision";
    reason.setAttribute("aria-label", "Reason for appeal decision");
    const actions = element("div", "admin-record-actions");
    for (const [status, label] of [["accepted", "Accept and reopen report"], ["rejected", "Reject appeal"]]) {
      const button = element("button", "secondary-button", label);
      button.type = "button";
      button.addEventListener("click", async () => {
        if (!reason.value.trim()) {
          reason.focus();
          reason.setCustomValidity("Enter a reason before recording this decision.");
          reason.reportValidity();
          reason.setCustomValidity("");
          return;
        }
        button.disabled = true;
        try {
          await api(`/api/admin/appeals/${appeal.id}`, {
            method: "PATCH",
            body: JSON.stringify({ status, reason: reason.value.trim() }),
          });
          await loadDashboard();
          feedback($("#dashboard-feedback"), status === "accepted" ? "Appeal accepted; report reopened for review." : "Appeal decision recorded.", "success");
        } catch (error) {
          feedback($("#dashboard-feedback"), error.message, "error");
          button.disabled = false;
        }
      });
      actions.append(button);
    }
    card.append(reason, actions);
    list.append(card);
  }
}

function renderAudit(entries) {
  const list = $("#audit-list");
  list.replaceChildren();
  if (!entries.length) {
    list.append(element("p", "admin-empty", "No moderation actions have been recorded."));
    return;
  }
  for (const entry of entries) {
    const row = element("article", "audit-record");
    row.append(
      element("strong", "", entry.action.replaceAll("_", " ")),
      element("span", "", `${entry.category.replaceAll("_", " ")} · ${entry.target}`),
      element("p", "", entry.reason),
      element("time", "", formatDate(entry.created_at)),
    );
    list.append(row);
  }
}

async function loadDashboard() {
  const status = $("#report-filter").value;
  const query = new URLSearchParams({
    status,
    limit: "20",
    offset: String(pageOffset),
    assigned_to: $("#assigned-filter").value,
    category: $("#category-filter").value,
    locale: $("#locale-filter").value,
  });
  if (query.get("assigned_to") === "__unassigned__") query.set("unassigned", "true");
  const [overview, reportResult, appealResult, auditResult, feedbackResult, operations] = await Promise.all([
    api("/api/admin/overview"),
    api(`/api/admin/reports?${query}`),
    api("/api/admin/appeals"),
    api("/api/admin/audit"),
    api("/api/admin/feedback"),
    api("/api/admin/operations"),
  ]);
  reports = reportResult.reports;
  pageHasMore = reportResult.has_more;
  $("#reports-page").textContent = `Page ${Math.floor(pageOffset / 20) + 1}`;
  $("#reports-previous").disabled = pageOffset === 0;
  $("#reports-next").disabled = !pageHasMore;
  for (const key of ["pending", "verified", "rejected", "escalated", "appeals"]) {
    $(`#count-${key}`).textContent = String(overview.counts[key] || 0);
  }
  renderReports();
  renderAppeals(appealResult.appeals);
  renderAudit(auditResult.entries);
  renderFeedback(feedbackResult.feedback);
  renderOperations(operations);
  if (adminRole === "admin") {
    renderThreatFeeds(await api("/api/admin/feed"));
    renderSessions(await api("/api/admin/sessions"));
  }
}

function renderFeedback(entries) {
  const list = $("#feedback-list");
  list.replaceChildren();
  if (!entries.length) {
    list.append(element("p", "admin-empty", "No pending check feedback."));
    return;
  }
  for (const entry of entries) {
    const card = element("article", "admin-record");
    card.append(
      element("h3", "", `${entry.input_type} check · ${entry.risk_label} · ${entry.locale}`),
      element("p", "admin-record-copy", entry.details),
      element("time", "", formatDate(entry.created_at)),
    );
    const resolve = element("button", "secondary-button", "Mark reviewed");
    resolve.type = "button";
    resolve.addEventListener("click", async () => {
      try {
        await api(`/api/admin/feedback/${entry.id}`, {
          method: "PATCH", body: JSON.stringify({ status: "reviewed", reason: "Reviewed user correction." }),
        });
        await loadDashboard();
      } catch (error) {
        feedback($("#dashboard-feedback"), error.message, "error");
      }
    });
    card.append(resolve);
    list.append(card);
  }
}

$("#admin-login").addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = $("button[type=submit]", event.currentTarget);
  submit.disabled = true;
  try {
    const result = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({
        username: $("#admin-username").value.trim(),
        password: $("#admin-password").value,
        totp: $("#admin-totp").value.trim(),
      }),
    });

    if (!adminActionsBound) {
      $("#feed-stage").addEventListener("click", async () => {
        const button = $("#feed-stage");
        try {
          const feed = JSON.parse($("#feed-json").value);
          button.disabled = true;
          await api("/api/admin/feed/stage", {
            method: "POST",
            body: JSON.stringify({ feed }),
          });
          $("#feed-json").value = "";
          await loadDashboard();
          feedback($("#feed-feedback"), "Feed validated and staged. Activate it after reviewing the version.", "success");
        } catch (error) {
          feedback($("#feed-feedback"), error instanceof SyntaxError ? "Enter valid JSON." : error.message, "error");
        } finally {
          button.disabled = false;
        }
      });

      $("#feed-rollback").addEventListener("click", async () => {
        const button = $("#feed-rollback");
        button.disabled = true;
        try {
          await api("/api/admin/feed/rollback", { method: "PUT", body: JSON.stringify({}) });
          await loadDashboard();
          feedback($("#feed-feedback"), "Threat-feed rolled back to the previous activated version.", "success");
        } catch (error) {
          feedback($("#feed-feedback"), error.message, "error");
        } finally {
          button.disabled = false;
        }
      });

      $("#session-revoke").addEventListener("click", async () => {
        const username = $("#session-user").value.trim();
        if (!username) {
          feedback($("#session-feedback"), "Enter a reviewer username.", "error");
          return;
        }
        try {
          const result = await api("/api/admin/sessions/revoke", {
            method: "POST",
            body: JSON.stringify({ username }),
          });
          $("#session-user").value = "";
          await loadDashboard();
          feedback($("#session-feedback"), `Revoked ${result.revoked} active session(s).`, "success");
        } catch (error) {
          feedback($("#session-feedback"), error.message, "error");
        }
      });

      $("#audit-export").addEventListener("click", async () => {
        const button = $("#audit-export");
        button.disabled = true;
        try {
          const response = await fetch("/api/admin/audit/export", {
            headers: { Authorization: `Bearer ${adminToken}` },
          });
          if (!response.ok) {
            let message = "The audit export could not be downloaded.";
            try {
              message = (await response.json()).error || message;
            } catch {}
            throw new Error(message);
          }
          const url = URL.createObjectURL(await response.blob());
          const link = element("a");
          link.href = url;
          link.download = "clearbeacon-audit.csv";
          link.click();
          URL.revokeObjectURL(url);
        } catch (error) {
          feedback($("#dashboard-feedback"), error.message, "error");
        } finally {
          button.disabled = false;
        }
      });
      adminActionsBound = true;
    }
    adminToken = result.token;
    adminRole = result.role;
    for (const item of document.querySelectorAll("[data-admin-only]")) item.hidden = adminRole !== "admin";
    await loadDashboard();
    $("#admin-login").hidden = true;
    $("#dashboard").hidden = false;
    sessionTimer = window.setTimeout(signOut, result.expires_in * 1000);
  } catch (error) {
    adminToken = "";
    feedback($("#login-feedback"), error.message, "error");
  } finally {
    submit.disabled = false;
  }
});

$("#report-filter").addEventListener("change", async () => {
  pageOffset = 0;
  try {
    await loadDashboard();
  } catch (error) {
    feedback($("#dashboard-feedback"), error.message, "error");
  }
});
for (const selector of ["#assigned-filter", "#category-filter", "#locale-filter"]) {
  $(selector).addEventListener("change", async () => {
    pageOffset = 0;
    try {
      await loadDashboard();
    } catch (error) {
      feedback($("#dashboard-feedback"), error.message, "error");
    }
  });
}
$("#report-search").addEventListener("input", renderReports);
$("#reports-previous").addEventListener("click", async () => {
  pageOffset = Math.max(0, pageOffset - 20);
  try { await loadDashboard(); } catch (error) { feedback($("#dashboard-feedback"), error.message, "error"); }
});
$("#reports-next").addEventListener("click", async () => {
  if (!pageHasMore) return;
  pageOffset += 20;
  try { await loadDashboard(); } catch (error) { pageOffset = Math.max(0, pageOffset - 20); feedback($("#dashboard-feedback"), error.message, "error"); }
});
$("#bulk-submit").addEventListener("click", async () => {
  const report_ids = [...document.querySelectorAll(".report-select:checked")].map((checkbox) => checkbox.value);
  if (!report_ids.length || !$("#bulk-reason").value.trim()) {
    feedback($("#dashboard-feedback"), "Select reports and enter an audit reason first.", "error");
    return;
  }
  if (!window.confirm(`Apply this decision to ${report_ids.length} selected reports?`)) return;
  try {
    const result = await api("/api/admin/reports/bulk", {
      method: "PUT",
      body: JSON.stringify({ report_ids, status: $("#bulk-status").value, reason: $("#bulk-reason").value.trim() }),
    });
    $("#bulk-reason").value = "";
    await loadDashboard();
    feedback($("#dashboard-feedback"), `${result.updated} reports updated.`, "success");
  } catch (error) {
    feedback($("#dashboard-feedback"), error.message, "error");
  }
});
$("#refresh-dashboard").addEventListener("click", async () => {
  try {
    await loadDashboard();
    feedback($("#dashboard-feedback"), "Dashboard refreshed.", "success");
  } catch (error) {
    feedback($("#dashboard-feedback"), error.message, "error");
  }
});
async function signOut() {
  if (sessionTimer) window.clearTimeout(sessionTimer);
  try {
    if (adminToken) await api("/api/admin/logout", { method: "POST", body: JSON.stringify({}) });
  } catch { /* The server expires sessions automatically. */ }
  adminToken = "";
  adminRole = "";
  reports = [];
  $("#dashboard").hidden = true;
  $("#admin-login").hidden = false;
  $("#admin-username").value = "";
  $("#admin-password").value = "";
  $("#login-feedback").hidden = true;
}
$("#admin-logout").addEventListener("click", signOut);
