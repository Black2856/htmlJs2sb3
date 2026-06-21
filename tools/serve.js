#!/usr/bin/env node
/**
 * serve.js
 * Lightweight static HTTP server for the project root.
 * No external dependencies.
 * CLI: node tools/serve.js [port]
 * Default port: 8123
 */

import { createServer } from 'http';
import { createReadStream, statSync, existsSync } from 'fs';
import { resolve, extname, join, normalize } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const MIME_TYPES = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.sb3': 'application/octet-stream',
};

const port = parseInt(process.argv[2] || '8123', 10);

const server = createServer((req, res) => {
  // Sanitize path
  let urlPath = req.url.split('?')[0];
  try {
    urlPath = decodeURIComponent(urlPath);
  } catch (_) {}

  // Normalize and prevent directory traversal
  const safePath = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(ROOT, safePath);

  // Default to index.html for directories
  try {
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      filePath = join(filePath, 'index.html');
    }
  } catch (_) {}

  if (!existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
    return;
  }

  let stat;
  try {
    stat = statSync(filePath);
  } catch (_) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('500 Internal Server Error');
    return;
  }

  if (stat.isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
    return;
  }

  const ext = extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

  res.writeHead(200, {
    'Content-Type': mimeType,
    'Content-Length': stat.size,
    'Cache-Control': 'no-cache',
  });

  const stream = createReadStream(filePath);
  stream.on('error', (err) => {
    res.end();
  });
  stream.pipe(res);
});

server.listen(port, () => {
  console.log(`Serving ${ROOT} on http://localhost:${port}`);
});
