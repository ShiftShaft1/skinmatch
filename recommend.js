// Turns YouCam skin-analysis output into a routine built from the merchant's own catalog.
// Pure functions: no DOM, no network, so it runs in the browser and in node tests.

export const LABELS = {
  acne: 'Blemishes', pore: 'Pores', texture: 'Texture', moisture: 'Hydration', oiliness: 'Oil balance',
  redness: 'Redness', radiance: 'Radiance', dark_circle_v2: 'Dark circles', age_spot: 'Dark spots', wrinkle: 'Fine lines',
};

// Lower raw_score = more room to improve. Returns concerns sorted worst first.
export function rankConcerns(output) {
  return output
    .filter(o => LABELS[o.type] && Number.isFinite(o.raw_score))
    .map(o => ({ type: o.type, label: LABELS[o.type], score: Math.round(o.ui_score ?? o.raw_score), raw: o.raw_score, mask: o.mask_urls?.[0] || null }))
    .sort((a, b) => a.raw - b.raw);
}

// Focus = the up-to-3 weakest areas; the gap (100 - raw) weights how much each one matters.
export function focusAreas(concerns, max = 3) {
  return concerns.slice(0, max).map(c => ({ ...c, weight: Math.max(0.05, (100 - c.raw) / 100) }));
}

function fit(product, focus) {
  return focus.reduce((s, c) => s + (product.targets[c.type] || 0) * c.weight, 0);
}

function reason(product, focus) {
  const hit = focus.filter(c => product.targets[c.type]).sort((a, b) => product.targets[b.type] * b.weight - product.targets[a.type] * a.weight)[0];
  if (!hit) return 'Daily essential';
  const ing = product.evidence?.[hit.type]?.[0];
  return ing ? `For ${hit.label.toLowerCase()}: contains ${ing}` : `For ${hit.label.toLowerCase()}`;
}

// Routine = 1 cleanser + 1 moisturizer + SPF (always) + up to 2 best-fit treatments.
export function buildRoutine(products, focus, maxTreatments = 2) {
  const best = kinds => products.filter(p => kinds.includes(p.kind)).sort((a, b) => fit(b, focus) - fit(a, focus))[0];
  const basics = [best(['Cleanser']), best(['Moisturizer']), best(['Sunscreen'])].filter(Boolean);
  const treatments = products
    .filter(p => !['Cleanser', 'Moisturizer', 'Sunscreen'].includes(p.kind) && fit(p, focus) > 0)
    .sort((a, b) => fit(b, focus) - fit(a, focus))
    .slice(0, maxTreatments);
  const items = [...basics, ...treatments].map(p => ({
    ...p,
    why: p.kind === 'Sunscreen' ? 'Every routine: daily sun protection' : basics.includes(p) && fit(p, focus) === 0 ? 'Daily essential' : reason(p, focus),
  }));
  const order = ['Cleanser', 'Serum', 'Treatment', 'Eye care', 'Moisturizer', 'Sunscreen'];
  const byOrder = (a, b) => order.indexOf(a.kind) - order.indexOf(b.kind);
  return {
    missing: ['Cleanser', 'Moisturizer', 'Sunscreen'].filter(k => !basics.some(b => b.kind === k)),
    am: items.filter(p => p.step !== 'pm').sort(byOrder),
    pm: items.filter(p => p.step !== 'am').sort(byOrder),
    items,
    total: items.reduce((s, p) => s + p.price, 0),
  };
}
