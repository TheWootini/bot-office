import http from 'http';

function get(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: 8787, path }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks), headers: res.headers }));
    }).on('error', reject);
  });
}

function post(path, obj) {
  const data = JSON.stringify(obj);
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: 8787, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

const fails = [];
const home = await get('/');
if (home.status !== 200) fails.push('GET /');
if (!home.body.toString().includes('Bot Office')) fails.push('HTML title/brand');
for (const p of ['/app.js', '/styles.css', '/api/health', '/api/cast']) {
  const r = await get(p);
  if (r.status !== 200) fails.push(`GET ${p} -> ${r.status}`);
}
const cast = JSON.parse((await get('/api/cast')).body.toString());
for (const c of cast.characters) {
  for (const [k, v] of Object.entries(c.assets)) {
    if (!v) { fails.push(`missing asset ${c.id}.${k}`); continue; }
    const r = await get(v);
    if (r.status !== 200) fails.push(`asset ${v} -> ${r.status}`);
  }
}
const poke = await post('/api/poke', { id: 'ceo' });
if (poke.status !== 200 || !JSON.parse(poke.body).ok) fails.push('POST /api/poke');

if (fails.length) {
  console.error('SMOKE FAIL');
  fails.forEach((f) => console.error(' -', f));
  process.exit(1);
}
console.log('SMOKE PASS', cast.characters.length, 'characters, all assets reachable');
