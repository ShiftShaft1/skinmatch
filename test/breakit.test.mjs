// Regression tests for the break-it review findings (25 Oct 2026).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { privateAddr } from '../api/catalog.js';
import { clientIp, rateLimit } from '../api/_youcam.js';
import { ingestProduct, ingestStore } from '../ingest.js';
import { buildRoutine, focusAreas, rankConcerns } from '../recommend.js';

// #3 hex-form IPv4-mapped IPv6
assert.ok(privateAddr('::ffff:7f00:1'));
assert.ok(privateAddr('::ffff:a9fe:a9fe'));
assert.ok(!privateAddr('::ffff:808:808'));
// #1 spoofed first hop ignored
assert.equal(clientIp({ headers: { 'x-forwarded-for': '1.1.1.1, 9.9.9.9' } }), '9.9.9.9');
assert.equal(clientIp({ headers: { 'x-real-ip': '5.5.5.5', 'x-forwarded-for': '1.1.1.1' } }), '5.5.5.5');
// #2 non-numeric caps fail closed to defaults (6 per IP)
process.env.PER_IP_PER_DAY = 'abc'; process.env.DAILY_CAP = 'abc';
let blocked = null;
for (let i = 0; i < 7; i++) blocked = rateLimit('7.7.7.7');
assert.ok(blocked, 'NaN cap must not disable the limit');
// #9 negation / advice is not an ingredient
const free = ingestProduct({ title: 'Barrier Cream', handle: 'b', body_html: 'Ceramides. Free of retinol and niacinamide.', variants: [] });
assert.deepEqual(Object.keys(free.evidence).sort(), ['moisture', 'redness']);
const spf = ingestProduct({ title: 'Mineral Sunscreen SPF 50', handle: 's', body_html: 'Zinc oxide. Use with vitamin C in the morning.', variants: [] });
assert.equal(spf.targets.radiance, undefined);
// #8 a cleanser that mentions retinol stays in both routines
const cl = ingestProduct({ title: 'Gentle Cleanser', handle: 'c', body_html: 'Oat. Pairs well with retinol at night.', variants: [] });
assert.equal(cl.step, 'both');
const cl2 = ingestProduct({ title: 'Retinol Cleanser', handle: 'c2', body_html: 'With retinol.', variants: [] });
assert.equal(cl2.step, 'both');
// #10, #11 kinds
const kind = (title) => ingestProduct({ title, handle: title, body_html: '', variants: [] })?.kind;
assert.equal(kind('Hydrating Serum 30ml'), 'Serum');
assert.equal(kind('Daily Gel Cleanser 150ml'), 'Cleanser');
assert.equal(kind('Tinted Moisturizer SPF 30'), 'Sunscreen');
assert.equal(kind('Moisturising Gel'), 'Moisturizer');
assert.equal(kind('Facial Oil'), 'Moisturizer');
assert.equal(kind('Hyaluronic Acid Moisturizer'), 'Moisturizer');
assert.equal(kind('Calm Spot Gel'), 'Treatment');
assert.equal(kind('Lip Tint'), undefined);
// #14 missing sunscreen is reported
const { products } = ingestStore(JSON.parse(readFileSync(new URL('../demo-store/products.json', import.meta.url))));
const noSpf = products.filter(p => p.kind !== 'Sunscreen');
const r = buildRoutine(noSpf, focusAreas(rankConcerns([{ type: 'pore', raw_score: 40 }])));
assert.deepEqual(r.missing, ['Sunscreen']);
console.log('breakit regression tests passed');
