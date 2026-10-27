// Draws a product as flat packaging in the page's two-ink print language (walnut on bone/tan).
// Used only when a store has no product photo (the fictional demo brand); real stores show their own images.

const TONES = ['#f7f4ee', '#bda38b', '#cdb89f'];
const INK = '#2b2216';
const esc = (v) => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function tone(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}

// Body, cap and label geometry per kind, in a 120x160 box standing on y=156.
const SHAPES = {
  Cleanser: { body: 'M38 20 h44 l6 112 q0 10 -10 10 h-36 q-10 0 -10 -10 z', cap: 'M40 142 h40 v14 h-40 z', label: [44, 52, 32, 56] },
  Serum: { body: 'M36 66 h48 q6 0 6 6 v78 q0 6 -6 6 h-48 q-6 0 -6 -6 v-78 q0 -6 6 -6 z', cap: 'M48 40 h24 v26 h-24 z M54 14 q6 -8 12 0 v26 h-12 z', label: [38, 86, 44, 52] },
  Moisturizer: { body: 'M22 92 h76 q4 0 4 4 v54 q0 6 -6 6 h-72 q-6 0 -6 -6 v-54 q0 -4 4 -4 z', cap: 'M20 72 h80 v20 h-80 z', label: [30, 104, 60, 38] },
  Sunscreen: { body: 'M40 30 h40 l5 104 q0 8 -8 8 h-34 q-8 0 -8 -8 z', cap: 'M42 142 h36 v14 h-36 z', label: [45, 58, 30, 60] },
  'Eye care': { body: 'M44 52 h32 q5 0 5 5 v93 q0 6 -6 6 h-30 q-6 0 -6 -6 v-93 q0 -5 5 -5 z', cap: 'M48 30 h24 v22 h-24 z M56 18 h18 v8 h-18 z', label: [47, 76, 26, 54] },
  Treatment: { body: 'M40 60 h40 q6 0 6 6 v84 q0 6 -6 6 h-40 q-6 0 -6 -6 v-84 q0 -6 6 -6 z', cap: 'M50 36 h20 v24 h-20 z M56 22 h26 v8 h-26 z', label: [42, 82, 36, 52] },
};

// Font size that keeps a label line inside its band (about 0.56em per character in this face).
const fit = (text, width, max) => Math.min(max, ((width - 6) / Math.max(1, text.length)) / 0.56).toFixed(2);

export function productArt(p, { title = true } = {}) {
  const s = SHAPES[p.kind] || SHAPES.Treatment;
  const [lx, ly, lw, lh] = s.label;
  const short = p.name.replace(/\b(Moisturizer|Cleanser|Serum|Cream|Treatment|Gel)\b/gi, '').trim().split(/\s+/).slice(0, 2).join(' ') || p.kind;
  const active = (p.key || '').split(' + ')[0];
  const t = tone(p.id || p.name);
  const label = `
    <rect x="${lx}" y="${ly}" width="${lw}" height="${lh}" fill="${INK}"/>
    <text x="${lx + lw / 2}" y="${ly + 12}" text-anchor="middle" font-size="${fit('Fieldnote', lw, 6.5)}" font-weight="600" fill="${t}">Fieldnote</text>
    <text x="${lx + lw / 2}" y="${ly + lh / 2 + 4}" text-anchor="middle" font-size="${fit(short, lw, 8)}" font-weight="600" fill="${t}">${esc(short)}</text>
    ${active && active !== 'No listed actives' ? `<text x="${lx + lw / 2}" y="${ly + lh - 7}" text-anchor="middle" font-size="${fit(active, lw, 5.5)}" fill="${t}">${esc(active)}</text>` : ''}`;
  return `<svg class="pack" viewBox="0 0 120 160" role="img" aria-label="${esc(p.name)}" font-family="Bricolage Grotesque, sans-serif">
    ${title ? `<title>${esc(p.name)}</title>` : ''}
    <path d="${s.body}" fill="${t}" stroke="#2b2216" stroke-opacity=".45" stroke-width="2"/>
    <path d="${s.cap}" fill="${INK}"/>
    ${label}
  </svg>`;
}
