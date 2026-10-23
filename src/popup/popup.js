import { MSG } from '../shared/messages.js';
import { normalize, cornerPosition, SETTINGS_KEY } from '../shared/settings.js';

const ALL_SITES = { origins: ['<all_urls>'] };
const $ = (sel) => document.querySelector(sel);

const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
const tabId = tab?.id;

function showStatus(text) {
  $('#status').textContent = text;
  $('#status').hidden = !text;
}

// Switch for this tab.

async function isEnabled() {
  const { enabledTabs = [] } = await chrome.storage.session.get('enabledTabs');
  return enabledTabs.includes(tabId);
}

$('#enabled').checked = await isEnabled();

$('#enabled').addEventListener('change', async (e) => {
  const enabled = e.target.checked;
  // Ask once for access to all sites, so the overlay can come back after the
  // tab navigates to another site. Without it, it still works on this page.
  if (enabled && !(await chrome.permissions.contains(ALL_SITES))) {
    await chrome.permissions.request(ALL_SITES).catch(() => false);
  }
  const res = await chrome.runtime.sendMessage({ type: MSG.SET_TAB_ENABLED, tabId, enabled });
  if (!res?.ok) {
    e.target.checked = false;
    showStatus("Chrome doesn't allow extensions on this page.");
  } else {
    showStatus('');
  }
});

$('#move').addEventListener('click', async () => {
  if (!(await isEnabled())) {
    showStatus('Turn the overlay on first.');
    return;
  }
  await chrome.tabs.sendMessage(tabId, { type: MSG.ENTER_MOVE_MODE }).catch(() => {});
  window.close();
});

// Settings, shared by all tabs.

let settings = normalize((await chrome.storage.sync.get(SETTINGS_KEY))[SETTINGS_KEY]);

const FORMAT = {
  size: (v) => `${v.toFixed(1)}×`,
  speed: (v) => `${v.toFixed(1)} s`,
  spacing: (v) => `${v} px`,
};

function render() {
  for (const input of document.querySelectorAll('[data-setting]')) {
    const key = input.dataset.setting;
    if (input.type === 'checkbox') input.checked = settings[key];
    else input.value = String(settings[key]);
    const out = document.getElementById(`${input.id}-out`);
    if (out) out.textContent = FORMAT[key](settings[key]);
  }
  for (const b of document.querySelectorAll('[data-corner]')) {
    const p = cornerPosition(b.dataset.corner);
    const active = p.x === settings.position.x && p.y === settings.position.y;
    b.setAttribute('aria-pressed', String(active));
  }
}

// Our own writes come back through storage.onChanged, possibly after newer
// local changes; remember them so they don't overwrite those changes.
const ownWrites = [];

async function save(changes) {
  settings = normalize({ ...settings, ...changes });
  render();
  ownWrites.push(JSON.stringify(settings));
  await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
}

for (const input of document.querySelectorAll('[data-setting]')) {
  const key = input.dataset.setting;
  const event = input.type === 'checkbox' ? 'change' : 'input';
  input.addEventListener(event, () => save({ [key]: input.type === 'checkbox' ? input.checked : Number(input.value) }));
}

for (const b of document.querySelectorAll('[data-corner]')) {
  b.addEventListener('click', () => save({ position: cornerPosition(b.dataset.corner) }));
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync' || !changes[SETTINGS_KEY]) return;
  const incoming = normalize(changes[SETTINGS_KEY].newValue);
  const own = ownWrites.indexOf(JSON.stringify(incoming));
  if (own !== -1) {
    ownWrites.splice(0, own + 1);
    return;
  }
  settings = incoming;
  render();
});

render();
document.body.dataset.ready = 'true';
