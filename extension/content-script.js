"use strict";

(() => {
  if (window.top !== window) return;

  let checkingLink = false;
  let activeDialog = null;

  function isWebLink(value) {
    try {
      const parsed = new URL(value, location.href);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  function addText(parent, tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = text;
    parent.append(element);
    return element;
  }

  function showDecision(url, result, error) {
    if (activeDialog) activeDialog.remove();
    const overlay = document.createElement("div");
    overlay.id = "scamshield-warning-root";
    overlay.className = "scamshield-warning-overlay";
    overlay.setAttribute("role", "presentation");
    const dialog = document.createElement("section");
    dialog.className = "scamshield-warning-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "scamshield-warning-title");
    dialog.setAttribute("aria-describedby", "scamshield-warning-description");

    const isRisk = result && ["high_risk", "caution"].includes(result.risk_label);
    const title = addText(
      dialog,
      "h2",
      isRisk ? "scamshield-warning-title risk" : "scamshield-warning-title",
      error ? "Link could not be checked" : (result?.title || "Unable to determine"),
    );
    title.id = "scamshield-warning-title";
    const description = addText(
      dialog,
      "p",
      "scamshield-warning-description",
      error
        ? `${error} You can stay here or continue without a result.`
        : result.risk_label === "unknown"
          ? "The local checks could not determine whether this link is safe. That does not mean it is safe."
          : "This is a risk signal, not proof of fraud. Review the evidence before deciding.",
    );
    description.id = "scamshield-warning-description";
    addText(dialog, "p", "scamshield-warning-url", url);
    if (result?.evidence?.length) {
      const list = document.createElement("ul");
      for (const item of result.evidence.slice(0, 4)) {
        addText(list, "li", "", item.text);
      }
      dialog.append(list);
    }

    const actions = document.createElement("div");
    actions.className = "scamshield-warning-actions";
    const stay = document.createElement("button");
    stay.type = "button";
    stay.className = "scamshield-warning-stay";
    stay.textContent = "Stay on this page";
    stay.addEventListener("click", () => {
      activeDialog?.remove();
      activeDialog = null;
    });
    const proceed = document.createElement("button");
    proceed.type = "button";
    proceed.className = "scamshield-warning-proceed";
    proceed.textContent = "Continue to link";
    proceed.addEventListener("click", () => {
      activeDialog?.remove();
      activeDialog = null;
      location.assign(url);
    });
    actions.append(stay, proceed);
    dialog.append(actions);
    overlay.append(dialog);
    document.documentElement.append(overlay);
    activeDialog = overlay;
    stay.focus();

    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        stay.click();
      }
      if (event.key === "Tab") {
        event.preventDefault();
        (document.activeElement === stay ? proceed : stay).focus();
      }
    });
  }

  document.addEventListener("click", async (event) => {
    if (checkingLink || event.defaultPrevented || event.button !== 0 ||
        event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const target = event.target instanceof Element ? event.target : null;
    const anchor = target?.closest("a[href]");
    if (!anchor || anchor.hasAttribute("download") || !isWebLink(anchor.href)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    checkingLink = true;
    try {
      const response = await chrome.runtime.sendMessage({
        type: "check-clicked-link",
        url: anchor.href,
      });
      if (!response || response.error) {
        showDecision(anchor.href, null, response?.error || "The ScamShield app did not respond.");
      } else {
        showDecision(anchor.href, response.result, "");
      }
    } catch {
      showDecision(anchor.href, null, "Cannot reach the local ScamShield app.");
    } finally {
      checkingLink = false;
    }
  }, true);
})();
