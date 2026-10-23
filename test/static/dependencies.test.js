// "Minimal" promise: nothing from npm ships inside the extension.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));

test('package.json has no runtime dependencies', () => {
  assert.deepEqual(pkg.dependencies ?? {}, {});
  assert.deepEqual(pkg.optionalDependencies ?? {}, {});
  assert.deepEqual(pkg.peerDependencies ?? {}, {});
});

test('package has no install scripts', () => {
  for (const hook of ['preinstall', 'install', 'postinstall', 'prepare']) {
    assert.equal(pkg.scripts?.[hook], undefined, hook);
  }
});
