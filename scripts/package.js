// Builds the Web Store upload: key-overlay-<version>.zip with manifest.json
// at the top level. Run with `npm run package`, which runs every check first.
//
// Refuses to package uncommitted changes, so every upload matches a commit,
// and prints content.js's SHA-256 to compare against the previous upload
// when reviewing what changed.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildExtension } from './build.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const allowDirty = process.argv.includes('--allow-dirty');

const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim();
if (dirty && !allowDirty) {
  process.stderr.write(`Commit your changes first, so the upload matches a commit:\n${dirty}\n`);
  process.exit(1);
}

const { version } = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
const dist = await buildExtension(join(root, 'dist'));
const zip = join(root, `key-overlay-${version}.zip`);
await rm(zip, { force: true });
// -X leaves out macOS extra attributes; run from inside dist/ so
// manifest.json is at the top of the zip.
execFileSync('zip', ['-r', '-X', '-q', zip, '.', '-x', '.*'], { cwd: dist });

const sha = createHash('sha256').update(await readFile(join(dist, 'content.js'))).digest('hex');
const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
process.stdout.write(
  `packaged ${zip}\n  version ${version}, commit ${commit}${dirty ? ' (with uncommitted changes)' : ''}\n  content.js sha256 ${sha}\n`,
);
