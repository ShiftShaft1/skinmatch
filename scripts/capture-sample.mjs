// One-off: run a real YouCam skin analysis on assets/sample-face.jpg and save it as the
// built-in sample (scores + mask PNGs), so the "sample face" button shows real API output.
// Usage: YOUCAM_API_KEY=... node scripts/capture-sample.mjs   (key from the shell, never committed)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { yc, apiKey, SD_ACTIONS } from '../api/_youcam.js';

if (!apiKey()) { console.error('Set YOUCAM_API_KEY first.'); process.exit(1); }
const img = readFileSync(new URL('../assets/sample-face.jpg', import.meta.url));
const file = (await yc('/file/skin-analysis', { method: 'POST', body: { files: [{ content_type: 'image/jpeg', file_name: 'sample-face.jpg', file_size: img.length }] } })).files[0];
const put = file.requests[0];
const up = await fetch(put.url, { method: put.method || 'PUT', headers: put.headers, body: img });
if (!up.ok) throw new Error(`upload ${up.status}`);
const { task_id } = await yc('/task/skin-analysis', { method: 'POST', body: { src_file_id: file.file_id, dst_actions: SD_ACTIONS, miniserver_args: { enable_mask_overlay: false }, format: 'json' } });

let data;
for (let i = 0; i < 60; i++) {
  await new Promise(r => setTimeout(r, 3000));
  data = await yc(`/task/skin-analysis/${encodeURIComponent(task_id)}`);
  if (data.task_status !== 'running') break;
}
if (data.task_status !== 'success') throw new Error(`task ended: ${JSON.stringify(data).slice(0, 300)}`);

mkdirSync(new URL('../assets/masks/', import.meta.url), { recursive: true });
const output = [];
for (const o of data.results.output) {
  const local = [];
  for (const [i, u] of (o.mask_urls || []).entries()) {
    const name = `assets/masks/${o.type}${i ? '-' + i : ''}.png`;
    writeFileSync(new URL('../' + name, import.meta.url), Buffer.from(await (await fetch(u)).arrayBuffer()));
    local.push(name);
  }
  output.push({ ...o, mask_urls: local });
}
writeFileSync(new URL('../assets/sample-result.json', import.meta.url),
  JSON.stringify({ illustrative: false, captured: new Date().toISOString(), output }, null, 2));
console.log(`Saved ${output.length} scores and masks.`);
