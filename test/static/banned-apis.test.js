// "Private" and "Doesn't interfere" promises, checked in source by plain text
// search (rules in banned.js). A match inside a comment still fails; reword
// the comment. built-bundle.test.js runs the same rules on the build output.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findBanned, walk } from './banned.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const srcDir = join(root, 'src');

const files = [];
for await (const f of walk(srcDir)) files.push(f);

test('src/ has files to check', () => {
  assert.ok(files.length > 0, 'src/ is empty');
});

for (const file of files) {
  test(`${relative(root, file)} uses no banned APIs`, async () => {
    const hits = findBanned(await readFile(file, 'utf8'));
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
