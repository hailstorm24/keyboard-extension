// "Private" and "Doesn't interfere" promises, checked by plain text search so
// they still hold if eslint.config.js is loosened. A match inside a comment
// still fails; reword the comment.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const srcDir = join(root, 'src');

const BANNED = [
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

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.(js|mjs|html)$/.test(e.name)) yield p;
  }
}

const files = [];
for await (const f of walk(srcDir)) files.push(f);

test('src/ has files to check', () => {
  assert.ok(files.length > 0, 'src/ is empty');
});

for (const file of files) {
  test(`${relative(root, file)} uses no banned APIs`, async () => {
    const lines = (await readFile(file, 'utf8')).split('\n');
    const hits = [];
    lines.forEach((line, i) => {
      for (const [re, why] of BANNED) {
        if (re.test(line)) hits.push(`  line ${i + 1}: ${line.trim()}  (${why})`);
      }
    });
    assert.equal(hits.length, 0, `banned APIs:\n${hits.join('\n')}`);
  });
}

test('HTML files load no remote scripts or styles', async () => {
  for (const file of files.filter((f) => f.endsWith('.html'))) {
    const html = await readFile(file, 'utf8');
    assert.doesNotMatch(html, /<script[^>]+src=["'](https?:)?\/\//i, file);
    assert.doesNotMatch(html, /<link[^>]+href=["'](https?:)?\/\//i, file);
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>\s*\S/i, `${file}: inline scripts are blocked by MV3`);
  }
});
