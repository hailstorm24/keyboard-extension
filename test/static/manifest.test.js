// "Minimal" and "Stays in its tab" promises: the manifest asks for exactly the
// permissions in the allowlist, and nothing that would let pages or the
// network reach into the extension.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8').catch(() => '{}'));
const allowlist = JSON.parse(await readFile(new URL('test/static/permissions.allowlist.json', root), 'utf8'));

const sorted = (xs = []) => [...xs].sort();

describe('manifest.json', () => {
  test('exists and is Manifest V3', () => {
    assert.equal(manifest.manifest_version, 3);
  });

  test('permissions match the allowlist exactly', () => {
    assert.deepEqual(sorted(manifest.permissions), sorted(allowlist.permissions));
  });

  test('host permissions match the allowlist exactly (none at install)', () => {
    assert.deepEqual(sorted(manifest.host_permissions), sorted(allowlist.host_permissions));
  });

  test('optional host permissions match the allowlist exactly', () => {
    assert.deepEqual(sorted(manifest.optional_host_permissions), sorted(allowlist.optional_host_permissions));
  });

  test('no optional API permissions beyond the allowlist', () => {
    assert.deepEqual(sorted(manifest.optional_permissions), []);
  });

  test('no content scripts injected automatically; injection is per tab', () => {
    assert.equal(manifest.content_scripts, undefined);
  });

  test('pages and other extensions cannot message the extension', () => {
    assert.equal(manifest.externally_connectable, undefined);
  });

  test('no files are exposed to web pages', () => {
    assert.equal(manifest.web_accessible_resources, undefined);
  });

  test('extension page CSP is not loosened', () => {
    const csp = manifest.content_security_policy?.extension_pages;
    if (csp === undefined) return;
    assert.doesNotMatch(csp, /unsafe-eval|unsafe-inline|https?:|wasm-unsafe-eval/);
  });

  test('background is a module service worker', () => {
    assert.equal(typeof manifest.background?.service_worker, 'string');
    assert.equal(manifest.background.type, 'module');
  });

  test('has a popup and the ⌥⇧K command', () => {
    assert.equal(typeof manifest.action?.default_popup, 'string');
    const cmd = Object.values(manifest.commands ?? {}).find((c) => c.suggested_key);
    assert.ok(cmd, 'a command with a suggested key');
    assert.equal(cmd.suggested_key.default, 'Alt+Shift+K');
  });

  test('does not allow running in incognito by default', () => {
    assert.notEqual(manifest.incognito, 'split');
  });

  test('no update_url pointing at a third-party server', () => {
    assert.equal(manifest.update_url, undefined);
  });
});
