// Tracks which tabs have the overlay on, injects the content script into
// them, and relays keys and clicks from child frames to the top frame.
//
// Every listener is registered at the top level so Chrome can wake this
// worker for it after stopping it.
import { MSG } from './shared/messages.js';

const ENABLED_KEY = 'enabledTabs';
const CONTENT_SCRIPT = 'content.js';

async function enabledTabs() {
  return (await chrome.storage.session.get(ENABLED_KEY))[ENABLED_KEY] ?? [];
}

async function saveEnabledTabs(ids) {
  await chrome.storage.session.set({ [ENABLED_KEY]: ids });
}

async function isEnabled(tabId) {
  return (await enabledTabs()).includes(tabId);
}

function isRestrictedUrl(url) {
  if (url === undefined) return false; // Unknown; let injection decide.
  let u;
  try {
    u = new URL(url);
  } catch {
    return true;
  }
  if (!['http:', 'https:', 'file:'].includes(u.protocol)) return true;
  return u.hostname === 'chromewebstore.google.com' || (u.hostname === 'chrome.google.com' && u.pathname.startsWith('/webstore'));
}

async function inject(tabId) {
  await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: [CONTENT_SCRIPT] });
}

async function setBadge(tabId, on) {
  await chrome.action.setBadgeText({ tabId, text: on ? 'ON' : '' }).catch(() => {});
}

export async function setTabEnabled(tabId, enabled) {
  const others = (await enabledTabs()).filter((id) => id !== tabId);
  if (!enabled) {
    await saveEnabledTabs(others);
    await setBadge(tabId, false);
    await chrome.tabs.sendMessage(tabId, { type: MSG.TEARDOWN }).catch(() => {});
    return { ok: true };
  }

  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab || isRestrictedUrl(tab.url)) return { ok: false, reason: 'restricted' };
  try {
    await inject(tabId);
  } catch {
    return { ok: false, reason: 'restricted' };
  }
  await saveEnabledTabs([...others, tabId]);
  await setBadge(tabId, true);
  return { ok: true };
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (sender.id !== chrome.runtime.id || !msg || typeof msg !== 'object') return;

  // Only extension pages (the popup) may turn tabs on or off.
  if (msg.type === MSG.SET_TAB_ENABLED && sender.url?.startsWith(chrome.runtime.getURL(''))) {
    setTabEnabled(msg.tabId, Boolean(msg.enabled)).then(reply);
    return true;
  }

  // Child frames send keys and clicks here; only the top frame draws.
  if ((msg.type === MSG.FRAME_KEY || msg.type === MSG.FRAME_CLICK) && sender.tab && sender.frameId !== 0) {
    chrome.tabs
      .sendMessage(sender.tab.id, { ...msg, frameUrl: sender.url }, { frameId: 0 })
      .catch(() => {});
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, info) => {
  if (info.status !== 'complete' || !(await isEnabled(tabId))) return;
  // The badge resets on navigation, and the new page needs the script again.
  await setBadge(tabId, true);
  await inject(tabId).catch(() => {});
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const ids = await enabledTabs();
  if (ids.includes(tabId)) await saveEnabledTabs(ids.filter((id) => id !== tabId));
});

// Move mode ends when the user switches away from a tab.
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  for (const id of await enabledTabs()) {
    if (id !== tabId) chrome.tabs.sendMessage(id, { type: MSG.EXIT_MOVE_MODE }).catch(() => {});
  }
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'toggle-overlay' || !tab?.id) return;
  await setTabEnabled(tab.id, !(await isEnabled(tab.id)));
});
