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
  const cutoutDir = path.join(ASSETS, 'cutout');
  // Prefer cutout still PNG, then non-cutout still jpg/png
  const stillCutoutPng = path.join(cutoutDir, `${id}-still.png`);
  const stillCutoutJpg = path.join(cutoutDir, `${id}-still.jpg`);
  let still = null;
  if (fs.existsSync(stillCutoutPng)) still = `/assets/cutout/${id}-still.png`;
  else if (fs.existsSync(stillCutoutJpg)) still = `/assets/cutout/${id}-still.jpg`;
  else still = firstExistingUrl(`${id}-still`, STILL_EXTS);

  const out = {
    still,
    cutout: {},
  };

  for (const state of ANIM_STATES) {
    // Prefer animated WebP (alpha in <img>), then WebM, then source MP4
    const webp = path.join(cutoutDir, `${id}-${state}.webp`);
    const webm = path.join(cutoutDir, `${id}-${state}.webm`);
    const mp4 = path.join(ASSETS, `${id}-${state}.mp4`);
    if (fs.existsSync(webp)) {
      const url = `/assets/cutout/${id}-${state}.webp`;
      out[state] = url;
      out.cutout[state] = url;
    } else if (fs.existsSync(webm)) {
      const url = `/assets/cutout/${id}-${state}.webm`;
      out[state] = url;
      out.cutout[state] = url;
    } else if (fs.existsSync(mp4)) {
      out[state] = `/assets/${id}-${state}.mp4`;
    } else {
      out[state] = null;
    }
  }

  if (fs.existsSync(stillCutoutPng)) {
    out.cutout.still = `/assets/cutout/${id}-still.png`;
  } else if (fs.existsSync(stillCutoutJpg)) {
    out.cutout.still = `/assets/cutout/${id}-still.jpg`;
  }

  // Back-compat: old sit.mp4 maps to work if work missing
  if (!out.work) {
    const sitWebp = path.join(cutoutDir, `${id}-sit.webp`);
    const sitCut = path.join(cutoutDir, `${id}-sit.webm`);
    const sit = path.join(ASSETS, `${id}-sit.mp4`);
    if (fs.existsSync(sitWebp)) {
      out.work = `/assets/cutout/${id}-sit.webp`;
      out.cutout.work = out.work;
    } else if (fs.existsSync(sitCut)) {
      out.work = `/assets/cutout/${id}-sit.webm`;
      out.cutout.work = out.work;
    } else if (fs.existsSync(sit)) {
      out.work = `/assets/${id}-sit.mp4`;
    }
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

function serveFile(req, res, filePath) {
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const cache =
      ext === '.html' || ext === '.js' || ext === '.css' ? 'no-cache' : 'public, max-age=60';
    const range = req && req.headers && req.headers.range;

    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!m) {
        res.writeHead(416, {
          'Content-Range': `bytes */${st.size}`,
          'Content-Type': 'text/plain',
        });
        res.end('Range Not Satisfiable');
        return;
      }
      let start = m[1] === '' ? 0 : parseInt(m[1], 10);
      let end = m[2] === '' ? st.size - 1 : parseInt(m[2], 10);
      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= st.size) {
        res.writeHead(416, {
          'Content-Range': `bytes */${st.size}`,
          'Content-Type': 'text/plain',
        });
        res.end('Range Not Satisfiable');
        return;
      }
      end = Math.min(end, st.size - 1);
      const chunk = end - start + 1;
      res.writeHead(206, {
        'Content-Type': type,
        'Content-Length': chunk,
        'Content-Range': `bytes ${start}-${end}/${st.size}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': cache,
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': st.size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': cache,
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
      serveFile(req, res, path.join(PUBLIC, 'index.html'));
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

    if (req.method === 'GET' && pathname === '/favicon.ico') {
      const ico = path.join(PUBLIC, 'favicon.svg');
      if (fs.existsSync(ico)) {
        serveFile(req, res, ico);
        return;
      }
      send(res, 204, '');
      return;
    }

    if (pathname.startsWith('/assets/')) {
      const rel = pathname.slice('/assets/'.length);
      const filePath = safeJoin(ASSETS, rel);
      if (!filePath) {
        send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain' });
        return;
      }
      serveFile(req, res, filePath);
      return;
    }

    if (req.method === 'GET') {
      const rel = pathname.replace(/^\//, '') || 'index.html';
      const filePath = safeJoin(PUBLIC, rel);
      if (!filePath) {
        send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain' });
        return;
      }
      serveFile(req, res, filePath);
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
