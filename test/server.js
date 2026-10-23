// Serves test/fixtures on two origins so cross-site iframe and navigation
// tests run offline:
//   http://localhost:3000   (the "top" site)
//   http://127.0.0.1:3001   (the "other" site, e.g. a payment iframe)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('./fixtures/', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };

// Per-file response headers.
const HEADERS = {
  '/strict-csp.html': { 'Content-Security-Policy': "default-src 'none'" },
};

export const ORIGINS = { top: 'http://localhost:3000', other: 'http://127.0.0.1:3001' };

// Serves `dir`. Exported so scripts can serve other folders the same way.
export function createHandler(dir) {
  return (req, res) => handle(dir, req, res);
}

function handler(req, res) {
  handle(dir, req, res);
}

function handle(dir, req, res) {
  const path = new URL(req.url, 'http://x').pathname;
  if (path === '/health') {
    res.writeHead(200).end('ok');
    return;
  }
  const file = normalize(join(dir, path === '/' ? 'recorder.html' : path));
  if (!file.startsWith(dir)) {
    res.writeHead(403).end();
    return;
  }
  readFile(file).then(
    (body) => {
      res.writeHead(200, {
        'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
        ...HEADERS[path],
      });
      res.end(body);
    },
    () => res.writeHead(404).end('not found'),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createServer(handler).listen(3000, 'localhost');
  createServer(handler).listen(3001, '127.0.0.1');
  process.stdout.write(`fixtures on ${ORIGINS.top} and ${ORIGINS.other}\n`);
}
