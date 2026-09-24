'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const HOST = '0.0.0.0';
const PORT = 8787;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const ASSETS = path.join(ROOT, 'assets');

const CAST = [
  { id: 'ceo', name: 'CEO', title: 'BookLooky chief of staff', initials: 'CE', hue: 340 },
  { id: 'ceo-f', name: 'CEO (F)', title: 'Female CEO variant', initials: 'CF', hue: 195 },
  { id: 'game-maker', name: 'Game Maker', title: 'Game Maker', initials: 'GM', hue: 145 },
  { id: 'game-artist', name: 'Game Artist', title: 'Game artist', initials: 'GA', hue: 265 },
  { id: 'helen', name: "Helen's Game", title: "Helen's Game", initials: 'HG', hue: 28 },
];

/** Animation / still keys expected under assets/ */
const STILL_EXTS = ['.png', '.jpg', '.jpeg'];
const ANIM_STATES = ['idle', 'work', 'talk', 'walk', 'movie-highfive'];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
};

function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Cache-Control': 'no-cache',
    ...headers,
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj, null, 2), {
    'Content-Type': 'application/json; charset=utf-8',
  });
}

function safeJoin(base, rel) {
  const resolved = path.normalize(path.join(base, rel));
  if (!resolved.startsWith(base)) return null;
  return resolved;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 1e6) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function firstExistingUrl(basename, exts) {
  for (const ext of exts) {
    const file = path.join(ASSETS, `${basename}${ext}`);
    if (fs.existsSync(file)) return `/assets/${basename}${ext}`;
  }
  return null;
}

function assetMapFor(id) {
  const out = {
    still: firstExistingUrl(`${id}-still`, STILL_EXTS),
  };
  for (const state of ANIM_STATES) {
    const mp4 = path.join(ASSETS, `${id}-${state}.mp4`);
    out[state] = fs.existsSync(mp4) ? `/assets/${id}-${state}.mp4` : null;
  }
  // Back-compat: old sit.mp4 maps to work if work missing
  if (!out.work) {
    const sit = path.join(ASSETS, `${id}-sit.mp4`);
    if (fs.existsSync(sit)) out.work = `/assets/${id}-sit.mp4`;
  }
  return out;
}

function listAssets() {
  const characters = CAST.map((c) => ({
    ...c,
    assets: assetMapFor(c.id),
  }));
  const room = fs.existsSync(path.join(ASSETS, 'office-room.png'))
    ? '/assets/office-room.png'
    : null;
  return { room, characters };
}

function serveFile(res, filePath) {
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': st.size,
      'Cache-Control': ext === '.html' || ext === '.js' || ext === '.css' ? 'no-cache' : 'public, max-age=60',
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    send(res, 204, '');
    return;
  }

  try {
    if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
      serveFile(res, path.join(PUBLIC, 'index.html'));
      return;
    }

    if (req.method === 'GET' && pathname === '/api/cast') {
      sendJson(res, 200, listAssets());
      return;
    }

    if (req.method === 'GET' && pathname === '/api/health') {
      sendJson(res, 200, { ok: true, port: PORT });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/poke') {
      const raw = await readBody(req);
      let body = {};
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        sendJson(res, 400, { ok: false, error: 'invalid JSON' });
        return;
      }
      const id = body && body.id;
      const known = CAST.find((c) => c.id === id);
      const stamp = new Date().toISOString();
      console.log(`[poke] ${stamp} id=${JSON.stringify(id)} known=${Boolean(known)}`);
      sendJson(res, 200, {
        ok: true,
        poked: id || null,
        known: Boolean(known),
        note: 'logged locally; webhook not wired yet',
      });
      return;
    }

    if (pathname.startsWith('/assets/')) {
      const rel = pathname.slice('/assets/'.length);
      const filePath = safeJoin(ASSETS, rel);
      if (!filePath) {
        send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain' });
        return;
      }
      serveFile(res, filePath);
      return;
    }

    if (req.method === 'GET') {
      const rel = pathname.replace(/^\//, '') || 'index.html';
      const filePath = safeJoin(PUBLIC, rel);
      if (!filePath) {
        send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain' });
        return;
      }
      serveFile(res, filePath);
      return;
    }

    sendJson(res, 405, { ok: false, error: 'method not allowed' });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { ok: false, error: 'server error' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Bot Office listening on http://${HOST}:${PORT}/`);
  console.log(`Drop character assets into ${ASSETS}`);
  console.log(`  {id}-still.png|jpg  {id}-idle|work|talk|walk|movie-highfive.mp4`);
});
