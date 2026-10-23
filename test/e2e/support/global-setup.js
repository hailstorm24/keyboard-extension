// Builds the extension once for the whole e2e run, then grants the optional
// <all_urls> host permission up front. Automation can't click Chrome's
// permission prompt, and the "Stays in its tab" tests are stronger with the
// broad permission granted: the extension must still only touch tabs that
// were turned on.
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildExtension } from '../../../scripts/build.js';

export const EXTENSION_DIR = fileURLToPath(new URL('../../../.e2e-extension/', import.meta.url));

export default async function globalSetup() {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  if (!existsSync(join(root, 'manifest.json'))) {
    throw new Error('manifest.json is missing. Build stage 1 (see docs/DESIGN.md) before running e2e tests.');
  }
  await buildExtension(EXTENSION_DIR);
  const path = join(EXTENSION_DIR, 'manifest.json');
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  manifest.host_permissions = [...(manifest.optional_host_permissions ?? [])];
  delete manifest.optional_host_permissions;
  await writeFile(path, JSON.stringify(manifest, null, 2));
}
