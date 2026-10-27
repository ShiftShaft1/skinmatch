import { rankConcerns, focusAreas, buildRoutine } from './recommend.js';
import { ingestStore } from './ingest.js';
import { productArt } from './product-art.js';

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => `$${Number(n).toFixed(0)}`;
const views = ['v-intro', 'v-wait', 'v-result'];
const show = (id) => views.forEach(v => { $(v).hidden = v !== id; });
const bag = new Map();

// Catalog: the store's public catalog (or the demo store), with the merchant's review applied from the URL
// (?off=ids&am=ids&pm=ids&both=ids), which the embed script passes through, so it works in any browser.
const params = new URLSearchParams(location.search);
const store = params.get('store') || 'demo';
const catalog = await loadCatalog(store);
async function loadCatalog(s) {
  const raw = s === 'demo'
    ? ingestStore(await fetch('demo-store/products.json').then(r => r.json()))
    : await fetch(`api/catalog?store=${encodeURIComponent(s)}`).then(x => x.ok ? x.json() : null).catch(() => null);
  if (!raw?.products?.length) return null;
  const ids = (k) => new Set((params.get(k) || '').split(',').filter(Boolean));
  const off = ids('off'), step = { am: ids('am'), pm: ids('pm'), both: ids('both') };
  const products = raw.products.filter(p => !off.has(p.id))
    .map(p => ({ ...p, step: Object.keys(step).find(k => step[k].has(p.id)) || p.step }));
  return products.length ? { products } : null;
}
if (store !== 'demo') {
  const name = store.replace(/^www\./, '').split('.')[0];
  document.querySelector('.logo').textContent = name.charAt(0).toUpperCase() + name.slice(1);
  document.querySelector('.card-brand').textContent = document.querySelector('.logo').textContent;
  document.querySelector('.foot p').textContent = 'Product matches come from the ingredients named in this store\'s listings. Skin analysis by the Perfect Corp. YouCam AI Skin Analysis API.';
}
if (!catalog) {
  const actions = document.querySelector('#v-intro .actions');
  actions.hidden = true;
  actions.after(Object.assign(document.createElement('p'), {
    className: 'error', textContent: 'This store\'s catalog is unavailable right now, so the skin check is turned off.',
  }));
}

// ---- photo in ----
$('photo').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const dataUrl = await resize(file);
    await analyzeLive(dataUrl);
  } catch (err) {
    fail(err.message);
  }
});

$('sampleBtn').addEventListener('click', async () => {
  const sample = await fetch('assets/sample-result.json').then(r => r.json());
  show('v-wait'); $('waitImg').src = 'assets/sample-face.jpg';
  $('waitText').textContent = 'Reading the sample face…';
  await new Promise(r => setTimeout(r, 1200));
  render('assets/sample-face.jpg', sample.output, sample.illustrative ? 'Sample result (illustrative scores)' : 'Sample result');
});

$('restart').addEventListener('click', () => show('v-intro'));

// Long side <= 1600 px keeps uploads small; YouCam SD needs the short side >= 480 px.
function resize(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, 1600 / Math.max(img.width, img.height));
      const w = Math.round(img.width * s), h = Math.round(img.height * s);
      if (Math.min(w, h) < 480) return reject(new Error('That photo is too small. Use one at least 480 px wide.'));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => reject(new Error('Could not read that image. Use a JPEG or PNG.'));
    img.src = URL.createObjectURL(file);
  });
}

async function analyzeLive(dataUrl) {
  show('v-wait'); $('waitImg').src = dataUrl;
  $('waitText').textContent = 'Uploading your photo…';
  const start = await fetch('api/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: dataUrl }),
  });
  const s = await start.json().catch(() => ({}));
  if (!start.ok) throw new Error(s.error || 'Could not start the analysis.');

  const steps = ['Finding your face…', 'Checking texture and pores…', 'Reading hydration and oil…', 'Mapping dark spots and redness…', 'Building your routine…'];
  for (let i = 0; i < 45; i++) { // ~90 s max
    $('waitText').textContent = steps[Math.min(i, steps.length - 1)];
    await new Promise(r => setTimeout(r, 2000));
    const r = await fetch(`api/result?id=${encodeURIComponent(s.task_id)}`).then(x => x.json()).catch(() => ({ status: 'running' }));
    if (r.status === 'success') return render(dataUrl, r.output, 'Your skin check');
    if (r.status === 'error') throw new Error(r.error);
  }
  throw new Error('The analysis is taking too long. Please try again.');
}

function fail(msg) {
  show('v-intro');
  let el = document.querySelector('.error');
  if (!el) { el = document.createElement('p'); el.className = 'error'; el.setAttribute('role', 'alert'); $('v-intro').querySelector('.actions').after(el); }
  el.textContent = msg;
}

// ---- results ----
function render(imgSrc, output, tag) {
  document.querySelector('.error')?.remove();
  const concerns = rankConcerns(output);
  if (!concerns.length) return fail('No skin scores came back. Try a clearer, front-facing photo.');
  const focus = focusAreas(concerns);
  const routine = buildRoutine(catalog.products, focus);

  $('resultTag').textContent = tag;
  $('focusText').textContent = focus.map(c => c.label.toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' and $1');
  $('resImg').src = imgSrc;
  $('maskImg').hidden = true;
  $('resImg').closest('.photo').classList.remove('dim');
  const anyMask = concerns.some(c => c.mask);
  $('maskCap').textContent = anyMask ? 'Tap an area to see where it shows' : '';
  concerns.forEach(c => { if (c.mask) new Image().src = c.mask; }); // preload so taps swap instantly

  // Overall = plain average of the 10 YouCam ui_scores (labelled as such in the UI).
  const overall = Math.round(concerns.reduce((s, c) => s + c.score, 0) / concerns.length);
  $('overall').textContent = overall;

  $('scores').replaceChildren(...concerns.map((c, i) => {
    const li = document.createElement('li');
    const isFocus = i < focus.length;
    li.className = isFocus ? 'focus' : '';
    const band = isFocus ? 'Focus' : c.score >= 90 ? 'Great' : 'Good';
    li.innerHTML = `<button type="button" ${c.mask ? '' : 'disabled'}><span>${c.label}</span><i class="lead" aria-hidden="true"></i><b>${c.score}</b><em>${band}</em></button>`;
    li.querySelector('button').addEventListener('click', () => toggleMask(li, c));
    return li;
  }));

  const art = (p) => p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">` : productArt(p);
  const row = (p) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="thumb">${art(p)}</span><span class="name">${esc(p.name)}</span><i class="lead" aria-hidden="true"></i><span class="price">${money(p.price)}</span><span class="why">${esc(p.why)}</span>`;
    li.title = p.blurb;
    return li;
  };
  $('am').replaceChildren(...routine.am.map(row));
  $('pm').replaceChildren(...routine.pm.map(row));
  $('shelf').innerHTML = routine.items.map(art).join('');
  $('missing').textContent = routine.missing.length
    ? `This store has no ${routine.missing.map(k => k.toLowerCase()).join(' or ')} in its catalog.${routine.missing.includes('Sunscreen') ? ' Wear a daily SPF from any brand.' : ''}` : '';
  $('routineCount').textContent = `${routine.items.length} products`;
  $('routineTotal').textContent = money(routine.total);
  $('addAll').onclick = () => { routine.items.forEach(p => bag.set(p.id, p)); renderBag(); openBag(); };
  show('v-result');
  document.querySelectorAll('.sheet, .routine-intro, .slip').forEach((el, i) => { el.classList.remove('rise'); void el.offsetWidth; el.style.animationDelay = `${i * 80}ms`; el.classList.add('rise'); });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

const MASK_STYLE = { oiliness: 'sheen', radiance: 'sheen', moisture: 'map', redness: 'tint', dark_circle_v2: 'glow' };

function toggleMask(li, c) {
  const on = !li.classList.contains('active');
  document.querySelectorAll('.scores li').forEach(x => x.classList.remove('active'));
  const img = $('maskImg');
  img.hidden = true; // never show the previous area's mask while the next one loads
  // YouCam's detections are shown as-is; only the rendering changes per type (sheen, tint, scan marks).
  img.className = `mask m-${MASK_STYLE[c.type] || 'mark'}`;
  img.closest('.photo').classList.toggle('dim', on && (MASK_STYLE[c.type] || 'mark') === 'mark');
  if (on) {
    li.classList.add('active');
    $('maskCap').textContent = `Showing: ${c.label}`;
    img.onload = () => { if (li.classList.contains('active')) img.hidden = false; };
    img.src = c.mask;
    if (img.complete && img.naturalWidth) img.hidden = false;
  } else $('maskCap').textContent = 'Tap an area to see where it shows';
}

// ---- bag ----
function renderBag() {
  const items = [...bag.values()];
  $('bagCount').textContent = items.length;
  $('bagTotal').textContent = money(items.reduce((s, p) => s + p.price, 0));
  $('bagList').replaceChildren(...items.map(p => {
    const li = document.createElement('li');
    li.innerHTML = `${p.image ? `<img src="${esc(p.image)}" alt="">` : productArt(p, { title: false })}<span>${esc(p.name)}</span><b>${money(p.price)}</b><button type="button" aria-label="Remove ${esc(p.name)}">×</button>`;
    li.querySelector('button').onclick = () => { bag.delete(p.id); renderBag(); };
    return li;
  }));
}
const openBag = () => { $('drawer').hidden = false; };
$('bagBtn').onclick = openBag;
$('closeBag').onclick = () => { $('drawer').hidden = true; };
$('drawer').addEventListener('click', (e) => { if (e.target.id === 'drawer') $('drawer').hidden = true; });
$('checkout').onclick = () => alert('Demo store: no real checkout.');

// ---- the intro plates: a slow crossfade, paused when hidden, off under reduced motion ----
const plates = [...document.querySelectorAll('.plate')];
if (plates.length > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  let i = 0;
  setInterval(() => {
    if (document.hidden || $('v-intro').hidden) return;
    plates[i].classList.remove('is-on');
    i = (i + 1) % plates.length;
    plates[i].classList.add('is-on');
  }, 6000);
}
