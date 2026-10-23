// Builds a loadable extension into dist/ (or the directory given as argv[2]).
//
// Content scripts injected with chrome.scripting can't be ES modules, so
// src/content/index.js and its imports are bundled into one content.js. The
// background service worker and popup load src/ modules as-is.
import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

export async function buildExtension(outDir = join(root, 'dist')) {
  outDir = resolve(outDir);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  // src/content/ ships only as the content.js bundle, and the icon source SVG
  // isn't used at runtime, so reviewers see one copy of each file.
  const skip = new Set([join(root, 'src', 'content'), join(root, 'icons', 'icon.svg')]);
  for (const entry of ['manifest.json', 'src', 'icons']) {
    const from = join(root, entry);
    if (existsSync(from)) await cp(from, join(outDir, entry), { recursive: true, filter: (p) => !skip.has(p) });
  }

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
