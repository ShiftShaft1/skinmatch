// Turns a Shopify-style products.json into a SkinMatch catalog.
// Each product is matched to skin concerns ONLY from ingredients named in its own title,
// tags or description, and every match keeps the ingredient as evidence for the shopper.
// Pure functions: runs in the browser, on the server and in node tests.

// Conservative cosmetic-function rules. Weight = how directly the ingredient targets the concern.
export const RULES = [
  { name: 'niacinamide', re: /niacinamide/, t: { pore: 1, oiliness: 0.8, texture: 0.5, redness: 0.5, age_spot: 0.4 } },
  { name: 'salicylic acid', re: /salicylic|\bbha\b|beta[- ]hydroxy/, t: { acne: 1, pore: 0.8, oiliness: 0.7 } },
  { name: 'benzoyl peroxide', re: /benzoyl peroxide/, t: { acne: 1 } },
  { name: 'azelaic acid', re: /azelaic/, t: { redness: 0.8, acne: 0.7, age_spot: 0.6 } },
  { name: 'tea tree', re: /tea tree|melaleuca/, t: { acne: 0.6 } },
  { name: 'clay', re: /\bclay\b|kaolin|bentonite/, t: { oiliness: 0.9, pore: 0.6 } },
  { name: 'zinc PCA', re: /zinc pca/, t: { oiliness: 0.6 } },
  { name: 'AHA', re: /glycolic|lactic acid|mandelic|\baha\b|alpha[- ]hydroxy/, t: { texture: 1, radiance: 0.7, age_spot: 0.5 } },
  { name: 'retinoid', re: /retinol|retinal\b|retinaldehyde|retinoid|retinyl|bakuchiol/, t: { wrinkle: 1, texture: 0.7, age_spot: 0.4 } },
  { name: 'vitamin C', re: /vitamin c|ascorbic|ascorbyl/, t: { radiance: 1, age_spot: 0.8 } },
  { name: 'brightening actives', re: /tranexamic|alpha[- ]arbutin|kojic|licorice|liquorice/, t: { age_spot: 1, radiance: 0.5 } },
  { name: 'hyaluronic acid', re: /hyaluronic|hyaluronate/, t: { moisture: 1 } },
  { name: 'ceramides', re: /ceramide/, t: { moisture: 0.9, redness: 0.6 } },
  { name: 'squalane', re: /squalane|shea butter/, t: { moisture: 0.5 } },
  { name: 'soothing botanicals', re: /centella|cica\b|madecassoside|allantoin|panthenol|colloidal oat|\boat\b|aloe/, t: { redness: 1, moisture: 0.4 } },
  { name: 'caffeine', re: /caffeine/, t: { dark_circle_v2: 1 } },
  { name: 'peptides', re: /peptide/, t: { wrinkle: 0.7, dark_circle_v2: 0.3 } },
  { name: 'SPF', re: /\bspf\b|sunscreen|zinc oxide|titanium dioxide|broad[- ]spectrum/, t: { age_spot: 0.5, wrinkle: 0.4 } },
];

// Order matters: specific words first, generic "treatment" last.
const KINDS = [
  ['Sunscreen', /\bspf\b|sunscreen|sun screen|sun fluid/],
  ['Eye care', /\beye\b/],
  ['Cleanser', /cleanser|face wash|cleansing|\bwash\b|soap/],
  ['Serum', /serum|essence|ampoule|booster/],
  ['Treatment', /\bspot\b|patch|toner|exfoliant|peel|mask|\bmist\b/],
  ['Moisturizer', /moisturi[sz](?:er|ing)|cream|lotion|balm|emulsion|hydrator|\bgel\b|\boil\b/],
  ['Treatment', /treatment/],
];

export const stripHtml = (s = '') => String(s).replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

// Not a single face-routine step: lips, body, hair, makeup, bundles, samples, merch.
const EXCLUDE = /\blips?\b|body|hand|foot|feet|hair|scalp|foundation|concealer|blush|bronzer|mascara|\bkit\b|collection|bundle|\bset\b|\bduo\b|\btrio\b|sachet|sample|mini\b|deluxe|travel|keychain|gift|bag\b|brush|tool|\brefills?\b/;

function kindOf(p) {
  const hay = `${p.product_type || ''} ${p.title || ''}`.toLowerCase();
  if (EXCLUDE.test(hay)) return null;
  return KINDS.find(([, re]) => re.test(hay))?.[0] || null;
}

// "Free of retinol", "pairs well with vitamin C", "use with SPF": mentions that are not in the product.
const NOT_IN_PRODUCT = /\b(?:free (?:of|from)|without|no|pairs? (?:well |nicely )?with|use (?:it )?(?:with|alongside|after|before)|follow (?:with|up with)|avoid(?:ing)?|do not (?:use|mix|combine)|compatible with|layer (?:with|under|over)|instead of)\b[^.;!?\n]*/g;
export const dropNonIngredients = (t) => t.replace(NOT_IN_PRODUCT, ' ');

function swatch(handle) {
  let h = 0;
  for (const c of handle) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 45% 88%)`;
}

export function ingestProduct(p) {
  const kind = kindOf(p);
  if (!kind) return null; // not a skincare step (gift card, merch, tool)
  const raw = `${p.title} ${(Array.isArray(p.tags) ? p.tags.join(' ') : p.tags || '')} ${stripHtml(p.body_html)}`.toLowerCase();
  const text = dropNonIngredients(raw);
  const targets = {}, evidence = {};
  // "Use with SPF" in a serum's copy is advice, not an ingredient: SPF only counts for sunscreens.
  const hits = RULES.filter(r => r.re.test(text) && (r.name !== 'SPF' || kind === 'Sunscreen'));
  for (const r of hits) {
    for (const [concern, w] of Object.entries(r.t)) {
      if (w > (targets[concern] || 0)) targets[concern] = w;
      (evidence[concern] ||= []).push(r.name);
    }
  }
  const actives = hits.map(r => r.name);
  // Basics (cleanser, moisturizer) stay AM+PM so both routines have them; sunscreen is AM.
  // Actives: retinoids PM, vitamin C leans AM, acids lean PM.
  const retinoid = /retin|bakuchiol/.test(text);
  const pm = retinoid || /glycolic|lactic acid|mandelic|\baha\b/.test(text);
  const am = /vitamin c|ascorbic/.test(text);
  const step = kind === 'Sunscreen' ? 'am' : ['Cleanser', 'Moisturizer'].includes(kind) ? 'both'
    : retinoid ? 'pm' : am && !pm ? 'am' : pm && !am ? 'pm' : 'both';
  const desc = stripHtml(p.body_html);
  return {
    id: p.handle || String(p.id),
    name: p.title,
    kind,
    step,
    price: Number(p.variants?.[0]?.price) || 0,
    image: p.images?.[0]?.src || null,
    color: swatch(p.handle || p.title || 'x'),
    key: actives.slice(0, 3).join(' + ') || 'No listed actives',
    blurb: desc.split(/(?<=[.!?])\s/)[0]?.slice(0, 160) || '',
    targets,
    evidence,
  };
}

export function ingestStore(json) {
  const list = Array.isArray(json?.products) ? json.products : [];
  const products = list.map(ingestProduct).filter(Boolean);
  return { products, skipped: list.length - products.length };
}
