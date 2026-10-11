"use strict";

importScripts("common.js");

const LINK_MENU_ID = "scamshield-check-link";
const SELECTION_MENU_ID = "scamshield-check-selection";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: LINK_MENU_ID,
      title: "Check link with ScamShield",
      contexts: ["link"],
      targetUrlPatterns: ["http://*/*", "https://*/*"],
    });
    chrome.contextMenus.create({
      id: SELECTION_MENU_ID,
      title: "Check selected text with ScamShield",
      contexts: ["selection"],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === LINK_MENU_ID) {
    void openCheckResult(info.linkUrl, "url");
  } else if (info.menuItemId === SELECTION_MENU_ID) {
    void openCheckResult(info.selectionText, "message");
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "set-link-warnings") {
    void setLinkWarnings(Boolean(message.enabled)).then(
      () => sendResponse({ enabled: Boolean(message.enabled) }),
      (error) => sendResponse({ error: error.message || "Could not update link warnings." }),
    );
    return true;
  }

  if (message?.type === "check-clicked-link") {
    void checkWithScamShield(message.url || "", "url").then(
      (result) => sendResponse({ result }),
      (error) => sendResponse({ error: error.message || "Could not check this link." }),
    );
    return true;
  }
  return false;
});

async function setLinkWarnings(enabled) {
  const contentScriptId = "scamshield-opt-in-link-warning";
  const registered = await chrome.scripting.getRegisteredContentScripts({ ids: [contentScriptId] });
  if (registered.length) {
    await chrome.scripting.unregisterContentScripts({ ids: [contentScriptId] });
  }
  if (enabled) {
    const hasPermission = await chrome.permissions.contains({
      origins: ["http://*/*", "https://*/*"],
    });
    if (!hasPermission) throw new Error("Website access permission is required to enable link warnings.");
    await chrome.scripting.registerContentScripts([{
      id: contentScriptId,
      matches: ["http://*/*", "https://*/*"],
      js: ["content-script.js"],
      css: ["warning.css"],
      runAt: "document_start",
      persistAcrossSessions: true,
    }]);
  }
  await chrome.storage.local.set({ linkWarningsEnabled: enabled });
}

async function openCheckResult(value, type) {
  const resultId = crypto.randomUUID();
  let result;
  try {
    result = await checkWithScamShield(value || "", type);
  } catch (error) {
    result = { error: error.message || "ScamShield could not analyze this input." };
  }
  await chrome.storage.session.set({ [`result-${resultId}`]: result });
  await chrome.tabs.create({
    url: chrome.runtime.getURL(`result.html?id=${encodeURIComponent(resultId)}`),
  });
}
