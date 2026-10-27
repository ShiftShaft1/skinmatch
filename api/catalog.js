// GET ?store=shop.example.com -> { products: [...] } from that store's public Shopify /products.json.
// The server fetches it because browsers block cross-origin reads. SSRF guards: public hostnames
// only, fixed path, every resolved address checked at connect time (no DNS rebinding window),
// no redirects, 8 s timeout, 5 MB streamed cap.
import https from 'node:https';
import { lookup as dnsLookup } from 'node:dns';
import { isIP } from 'node:net';
import { ingestStore } from '../ingest.js';

const HOST_RE = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const MAX_BYTES = 5_000_000;

function v4private(ip) {
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

export function privateAddr(ip) {
  if (!ip.includes(':')) return v4private(ip);
  const v = ip.toLowerCase();
  const mapped = v.match(/^::ffff:(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/);
  if (mapped) {
    if (mapped[1]) return v4private(mapped[1]);
    const hi = parseInt(mapped[2], 16), lo = parseInt(mapped[3], 16);
    return v4private(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  return v === '::1' || v === '::' || /^f[cd]/.test(v) || v.startsWith('fe80') || v.startsWith('64:ff9b');
}

export function normalizeHost(input) {
  let s = String(input || '').trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '').split(/[/?#]/)[0];
  if (s.includes('@') || s.includes(':') || isIP(s) || !HOST_RE.test(s) || s.endsWith('.local') || s.endsWith('.internal')) return null;
  return s;
}

// DNS lookup used by the socket itself: rejects private addresses at connect time.
function guardedLookup(hostname, opts, cb) {
  dnsLookup(hostname, { ...opts, all: true }, (err, addrs) => {
    if (err) return cb(err);
    if (!addrs.length || addrs.some(a => privateAddr(a.address))) return cb(Object.assign(new Error('blocked address'), { code: 'BLOCKED' }));
    if (opts.all) return cb(null, addrs);
    cb(null, addrs[0].address, addrs[0].family);
  });
}

function getJson(host) {
  return new Promise((resolve, reject) => {
    const req = https.get({ host, path: '/products.json?limit=250', lookup: guardedLookup, headers: { Accept: 'application/json', 'User-Agent': 'SkinMatch/1.0' }, timeout: 8000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400) { res.resume(); return reject(Object.assign(new Error('redirect'), { code: 'REDIRECT' })); }
      if (res.statusCode !== 200) { res.resume(); return reject(Object.assign(new Error('status'), { code: 'NOT_FOUND' })); }
      if (Number(res.headers['content-length']) > MAX_BYTES) { res.destroy(); return reject(Object.assign(new Error('big'), { code: 'TOO_BIG' })); }
      let size = 0; const chunks = [];
      res.on('data', (c) => { size += c.length; if (size > MAX_BYTES) { res.destroy(); reject(Object.assign(new Error('big'), { code: 'TOO_BIG' })); } else chunks.push(c); });
      res.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(Object.assign(new Error('json'), { code: 'BAD_JSON' })); } });
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(Object.assign(new Error('timeout'), { code: 'TIMEOUT' })));
    req.on('error', reject);
  });
}

const MESSAGES = {
  BLOCKED: [400, 'That address is not allowed.'],
  REDIRECT: [400, 'The store redirected. Use its main domain (the one in the browser bar).'],
  NOT_FOUND: [404, 'No public Shopify catalog found at that domain.'],
  TOO_BIG: [413, 'Catalog too large.'],
  TIMEOUT: [504, 'The store took too long to answer.'],
  BAD_JSON: [502, 'That store did not return a product catalog.'],
};

export default async function handler(req, res) {
  const host = normalizeHost(req.query.store);
  if (!host) return res.status(400).json({ error: 'Enter a store domain like yourstore.com' });
  try {
    const out = ingestStore(await getJson(host));
    res.setHeader('Cache-Control', 's-maxage=600');
    return res.status(200).json({ store: host, ...out });
  } catch (e) {
    const [code, msg] = MESSAGES[e.code] || [502, 'Could not read that store\'s catalog.'];
    return res.status(code).json({ error: msg });
  }
}
