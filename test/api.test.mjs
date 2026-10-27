// Mocks fetch to check the analyze -> result handler flow without a real YouCam key.
import assert from 'node:assert/strict';
process.env.YOUCAM_API_KEY = 'test-key';
const calls = [];
globalThis.fetch = async (url, opts = {}) => {
  calls.push([opts.method || 'GET', String(url)]);
  const json = (data) => ({ ok: true, status: 200, json: async () => ({ status: 200, data }) });
  if (url.endsWith('/file/skin-analysis')) return json({ files: [{ file_id: 'FILE1', requests: [{ method: 'PUT', url: 'https://s3/up', headers: {} }] }] });
  if (url === 'https://s3/up') return { ok: true, status: 200 };
  if (url.endsWith('/task/skin-analysis')) return json({ task_id: 'TASK_abc-123456' });
  if (url.includes('/task/skin-analysis/TASK_abc-123456')) return json({ task_status: 'success', results: { output: [{ type: 'pore', ui_score: 80, raw_score: 70, mask_urls: ['m.png'] }] } });
  throw new Error('unexpected ' + url);
};
const res = () => { const r = { code: 0, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; };
const { default: analyze } = await import('../api/analyze.js');
const { default: result } = await import('../api/result.js');

const img = 'data:image/jpeg;base64,' + Buffer.from('fakejpeg').toString('base64');
let r = res(); await analyze({ method: 'POST', body: { image: img }, headers: {}, socket: {} }, r);
assert.equal(r.code, 200); assert.equal(r.body.task_id, 'TASK_abc-123456');
assert.deepEqual(calls.map(c => c[0]), ['POST', 'PUT', 'POST']);

r = res(); await result({ query: { id: 'TASK_abc-123456' } }, r);
assert.equal(r.body.status, 'success'); assert.equal(r.body.output[0].type, 'pore');

r = res(); await analyze({ method: 'POST', body: { image: 'data:text/html;base64,AAAA' }, headers: {}, socket: {} }, r);
assert.equal(r.code, 400);
r = res(); await result({ query: { id: '../../etc' } }, r);
assert.equal(r.code, 400);
for (let i = 0; i < 6; i++) await analyze({ method: 'POST', body: { image: img }, headers: { 'x-forwarded-for': '9.9.9.9' }, socket: {} }, res());
r = res(); await analyze({ method: 'POST', body: { image: img }, headers: { 'x-forwarded-for': '9.9.9.9' }, socket: {} }, r);
assert.equal(r.code, 429, 'per-IP limit');
console.log('api tests passed');
