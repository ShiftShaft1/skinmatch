import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ingestStore, ingestProduct } from '../ingest.js';
import { rankConcerns, focusAreas, buildRoutine } from '../recommend.js';

const store = JSON.parse(readFileSync(new URL('../demo-store/products.json', import.meta.url)));
const { products, skipped } = ingestStore(store);
const by = Object.fromEntries(products.map(p => [p.id, p]));

assert.equal(skipped, 1, 'tote bag is not a skincare step');
assert.equal(by['clear-day-gel-cleanser'].kind, 'Cleanser');
assert.deepEqual(by['pore-edit-serum'].evidence.pore, ['niacinamide']);
assert.equal(by['night-shift-serum'].step, 'pm', 'retinoid -> evening');
assert.equal(by['morning-light-serum'].step, 'am', 'vitamin C -> morning');
assert.equal(by['daily-veil-spf-50'].kind, 'Sunscreen');
assert.equal(by['wide-awake-eye-cream'].kind, 'Eye care');
assert.equal(by['calm-spot-treatment'].targets.acne, 1);
assert.equal(by['pore-edit-serum'].price, 26);

// No ingredient named -> no concern claimed.
const plain = ingestProduct({ title: 'Simple Cream', handle: 'simple', body_html: '<p>A nice cream.</p>', variants: [{ price: '10' }] });
assert.deepEqual(plain.targets, {});
assert.equal(plain.key, 'No listed actives');

// "retinal" must not match "retinaldehyde"-free text like "retina"; "oat" must not match "coat".
const coat = ingestProduct({ title: 'Coat Shield Cream', handle: 'c', body_html: 'Protects the retina area.', variants: [] });
assert.equal(coat.evidence.redness, undefined);
assert.equal(coat.evidence.wrinkle, undefined);

// End to end: oily skin gets evidence-backed picks.
const out = Object.entries({ oiliness: 30, pore: 38, acne: 45, moisture: 85, redness: 88 }).map(([type, raw]) => ({ type, raw_score: raw, ui_score: raw }));
const r = buildRoutine(products, focusAreas(rankConcerns(out)));
const serum = r.items.find(p => p.id === 'pore-edit-serum');
assert.ok(serum, 'niacinamide serum picked for oil and pores');
assert.match(serum.why, /contains niacinamide/);
console.log('ingest tests passed');
// "use with SPF" in a serum is not an SPF claim; retinoid + vitamin C goes to PM.
const fade = ingestProduct({ title: 'Fade Serum', handle: 'f', body_html: 'Tranexamic acid. Always use with SPF.', variants: [] });
assert.equal(fade.evidence.wrinkle, undefined);
assert.ok(!fade.key.includes('SPF'));
assert.equal(ingestProduct({ title: 'Night Serum', handle: 'n', body_html: 'Retinol and vitamin C.', variants: [] }).step, 'pm');
console.log('ingest edge tests passed');
