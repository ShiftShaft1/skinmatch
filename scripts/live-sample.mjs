// Runs the real YouCam analysis through the deployed SkinMatch API on assets/sample-face.jpg
// and saves scores + mask PNGs as the built-in sample. No key needed locally.
// Usage: node scripts/live-sample.mjs https://your-app.vercel.app
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const base = process.argv[2];
if (!base) { console.error('Usage: node scripts/live-sample.mjs <deployed URL>'); process.exit(1); }
const img = 'data:image/jpeg;base64,' + readFileSync(new URL('../assets/sample-face.jpg', import.meta.url)).toString('base64');
const start = await fetch(`${base}/api/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: img }) });
const s = await start.json();
console.log('analyze:', start.status, JSON.stringify(s));
if (!start.ok) process.exit(1);
let r;
for (let i = 0; i < 45; i++) {
  await new Promise(x => setTimeout(x, 3000));
  r = await (await fetch(`${base}/api/result?id=${encodeURIComponent(s.task_id)}`)).json();
  process.stdout.write(r.status + ' ');
  if (r.status !== 'running') break;
}
console.log();
if (r.status !== 'success') { console.log(JSON.stringify(r)); process.exit(1); }
mkdirSync(new URL('../assets/masks/', import.meta.url), { recursive: true });
const output = [];
for (const o of r.output) {
  const local = [];
  for (const [i, u] of (o.mask_urls || []).entries()) {
    const name = `assets/masks/${o.type}${i ? '-' + i : ''}.png`;
    writeFileSync(new URL('../' + name, import.meta.url), Buffer.from(await (await fetch(u)).arrayBuffer()));
    local.push(name);
  }
  output.push({ type: o.type, ui_score: o.ui_score, raw_score: o.raw_score, mask_urls: local });
}
writeFileSync(new URL('../assets/sample-result.json', import.meta.url),
  JSON.stringify({ illustrative: false, captured: new Date().toISOString(), note: 'Real YouCam AI Skin Analysis output for assets/sample-face.jpg (an AI-generated fictional person).', output }, null, 2));
output.forEach(o => console.log(o.type.padEnd(15), o.ui_score, o.raw_score, o.mask_urls.length + ' mask'));
