// Builds a loadable extension into dist/ (or the directory given as argv[2]).
//
// Content scripts injected with chrome.scripting can't be ES modules, so
// src/content/index.js and its imports are bundled into one content.js. The
// background service worker and popup load src/ modules as-is.
import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

export async function buildExtension(outDir = join(root, 'dist')) {
  outDir = resolve(outDir);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  for (const entry of ['manifest.json', 'src', 'icons']) {
    const from = join(root, entry);
    if (existsSync(from)) await cp(from, join(outDir, entry), { recursive: true });
  }

  // Mark the built manifest, so an extension loaded from the source folder
  // (which has no content.js) can tell the user to load dist/ instead.
  const manifestPath = join(outDir, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.version_name = `${manifest.version} (built)`;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  await build({
    entryPoints: [join(root, 'src/content/index.js')],
    outfile: join(outDir, 'content.js'),
    bundle: true,
    format: 'iife',
    target: 'chrome120',
    loader: { '.css': 'text' },
    legalComments: 'none',
    logLevel: 'warning',
  });

  return outDir;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = await buildExtension(process.argv[2]);
  process.stdout.write(`built ${out}\n`);
}
