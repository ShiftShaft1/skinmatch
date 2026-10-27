import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rankConcerns, focusAreas, buildRoutine } from '../recommend.js';
import { ingestStore } from '../ingest.js';

const { products } = ingestStore(JSON.parse(readFileSync(new URL('../demo-store/products.json', import.meta.url))));
const out = (o) => Object.entries(o).map(([type, raw]) => ({ type, raw_score: raw, ui_score: raw + 10, mask_urls: [`https://x/${type}.png`] }));

// Oily, breakout-prone skin -> gel cleanser, water gel, niacinamide or spot gel.
let focus = focusAreas(rankConcerns(out({ oiliness: 30, acne: 35, pore: 40, moisture: 85, redness: 90, wrinkle: 92, radiance: 80 })));
assert.deepEqual(focus.map(c => c.type), ['oiliness', 'acne', 'pore']);
let r = buildRoutine(products, focus);
const ids = r.items.map(p => p.id);
assert.ok(ids.includes('clear-day-gel-cleanser'));
assert.ok(ids.includes('water-gel-moisturizer'));
assert.ok(ids.includes('daily-veil-spf-50'), 'SPF is always included');
assert.ok(ids.includes('pore-edit-serum'));
assert.ok(!ids.includes('night-shift-serum'), 'no anti-aging pick for oily/acne skin');
assert.ok(r.am.every(p => p.step !== 'pm') && r.pm.every(p => p.step !== 'am'));
assert.equal(r.am[0].kind, 'Cleanser');
assert.equal(r.am.at(-1).kind, 'Sunscreen');
assert.equal(r.total, r.items.reduce((s, p) => s + p.price, 0));

// Dry, red, lined skin -> cream cleanser, barrier balm, retinal.
focus = focusAreas(rankConcerns(out({ moisture: 25, redness: 40, wrinkle: 45, oiliness: 90, acne: 95 })));
r = buildRoutine(products, focus);
assert.ok(r.items.some(p => p.id === 'soft-milk-cream-cleanser'));
assert.ok(r.items.some(p => p.id === 'barrier-balm-moisturizer'));
assert.ok(r.items.some(p => p.id === 'night-shift-serum'));
assert.ok(r.items.length <= 5);

// Unknown types and missing scores are ignored, not crashed on.
assert.deepEqual(rankConcerns([{ type: 'skin_type', raw_score: 1 }, { type: 'acne' }]), []);
console.log('recommend tests passed');
