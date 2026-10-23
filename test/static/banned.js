// Banned-API rules shared by the source scan (banned-apis.test.js) and the
// built-bundle scan (built-bundle.test.js). Plain text search, so the rules
// hold even if eslint.config.js is loosened.
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export const BANNED = [
  [/\bfetch\s*\(/, 'network request'],
  [/\bXMLHttpRequest\b/, 'network request'],
  [/\bWebSocket\b/, 'network request'],
  [/\bEventSource\b/, 'network request'],
  [/\bsendBeacon\b/, 'network request'],
  [/\bimportScripts\b/, 'dynamic code'],
  [/\beval\s*\(/, 'dynamic code'],
  [/\bnew\s+Function\b/, 'dynamic code'],
  [/\bimport\s*\(/, 'dynamic import'],
  [/\bpostMessage\b/, 'readable by the page; use chrome.runtime messaging'],
  [/\.(innerHTML|outerHTML)\b/, 'use textContent'],
  [/\binsertAdjacentHTML\b/, 'use textContent'],
  [/\bdocument\.write\b/, 'use textContent'],
  [/\bpreventDefault\b/, 'must not change page behavior'],
  [/\bstop(Immediate)?Propagation\b/, 'must not change page behavior'],
  [/\b(localStorage|sessionStorage|indexedDB)\b/, 'only chrome.storage, only for settings'],
  [/\bchrome\.storage\.local\b/, 'settings use storage.sync, tab state uses storage.session'],
  [/\bconsole\.\w+\s*\(/, 'no logging'],
  [/\bchrome\.runtime\.connectExternal\b|\bonMessageExternal\b|\bonConnectExternal\b/, 'no external messaging'],
  [/https?:\/\//, 'no URLs in shipped code'],
];

// Other ways code can reach the network. Checked in the built bundle, where
// code from the build tools could appear, and in source.
export const NETWORK = [
  [/\bRTCPeerConnection\b|\bRTCDataChannel\b/, 'network connection (WebRTC)'],
  [/\bWebTransport\b/, 'network connection (WebTransport)'],
  [/\bwss?:\/\//, 'WebSocket URL'],
  [/\bnew\s+Image\s*\(/, 'image load can send data in its URL'],
  [/\.src\s*=(?!=)/, 'setting src loads a URL'],
  [/\.(href|action|formAction)\s*=(?!=)/, 'navigation or form target can send data'],
  [/\bsetAttribute\(\s*["'](src|href|action|srcset|poster|data)["']/, 'setting a URL attribute loads it'],
  [/\burl\(\s*["']?(?!data:)[^)"'\s]/, 'CSS url() loads a resource'],
  [/@import\b/, 'CSS @import loads a resource'],
  [/\bchrome\.(downloads|identity|webRequest|declarativeNetRequest|cookies)\b/, 'API outside the permission allowlist'],
];

export const ALL_RULES = [...BANNED, ...NETWORK];

// Returns one line per match: "line N: <text>  (<reason>)".
export function findBanned(text, rules = ALL_RULES) {
  const hits = [];
  text.split('\n').forEach((line, i) => {
    for (const [re, why] of rules) {
      if (re.test(line)) hits.push(`  line ${i + 1}: ${line.trim().slice(0, 160)}  (${why})`);
    }
  });
  return hits;
}

export async function* walk(dir, pattern = /\.(js|mjs|html|css)$/) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p, pattern);
    else if (pattern.test(e.name)) yield p;
  }
}
