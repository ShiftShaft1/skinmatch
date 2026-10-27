import { ingestStore } from './ingest.js';
import { LABELS } from './recommend.js';

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let state = null; // { store, products }

const err = (msg) => { $('err').hidden = !msg; $('err').textContent = msg || ''; };

$('demoBtn').onclick = async () => {
  err('');
  const json = await fetch('demo-store/products.json').then(r => r.json());
  load('demo', ingestStore(json));
};

$('storeForm').onsubmit = async (e) => {
  e.preventDefault();
  err('');
  const store = $('store').value.trim();
  if (!store) return err('Enter your store domain.');
  const btn = e.submitter; btn.disabled = true; btn.textContent = 'Reading your catalog…';
  try {
    const r = await fetch(`api/catalog?store=${encodeURIComponent(store)}`);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Could not read that store.');
    load(data.store, data);
  } catch (x) { err(x.message); }
  finally { btn.disabled = false; btn.textContent = 'Build my skin check'; }
};

function load(store, { products, skipped = 0 }) {
  if (!products.length) return err('No face-care products found in that catalog.');
  state = { store, products: products.map(p => ({ ...p, off: false, step0: p.step })) };
  render(skipped);
  $('out').hidden = false;
  $('out').scrollIntoView({ behavior: 'smooth' });
}

function render(skipped = 0) {
  const live = state.products.filter(p => !p.off);
  const covered = new Set(live.flatMap(p => Object.keys(p.targets)));
  const gaps = Object.keys(LABELS).filter(c => !covered.has(c)).map(c => LABELS[c].toLowerCase());
  const mapped = live.filter(p => Object.keys(p.targets).length).length;
  $('summary').innerHTML = `<span><b>${live.length}</b> face-care products</span><span><b>${mapped}</b> matched to concerns</span>`
    + (skipped ? `<span>${skipped} left out (lips, body, makeup, kits, or not a routine step)</span>` : '')
    + (gaps.length ? `<span class="gap">No product for: ${gaps.join(', ')}</span>` : '<span>All 10 concerns covered</span>');

  $('rows').replaceChildren(...state.products.map((p, i) => {
    const tr = document.createElement('tr');
    tr.dataset.off = p.off;
    const chips = Object.entries(p.targets).sort((a, b) => b[1] - a[1])
      .map(([c]) => `<span class="chip"><b>${LABELS[c]}</b> · ${esc(p.evidence[c].join(', '))}</span>`).join('') || '<span class="none">No listed actives: basics only</span>';
    tr.innerHTML = `<td><input type="checkbox" ${p.off ? '' : 'checked'} aria-label="Use ${esc(p.name)}"></td>
      <td><strong>${esc(p.name)}</strong><br><small>${esc(p.kind)} · $${esc(p.price)}</small></td>
      <td><select aria-label="Step for ${esc(p.name)}">${['am', 'pm', 'both'].map(s => `<option ${s === p.step ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
      <td>${chips}</td>`;
    tr.querySelector('input').onchange = (e) => { state.products[i].off = !e.target.checked; render(skipped); };
    tr.querySelector('select').onchange = (e) => { state.products[i].step = e.target.value; links(); };
    return tr;
  }));
  links();
}

// The review travels in the URL (off / am / pm / both id lists), so it works for every shopper and browser.
function overrides() {
  const q = { off: [], am: [], pm: [], both: [] };
  for (const p of state.products) {
    if (p.off) q.off.push(p.id);
    else if (p.step !== p.step0) q[p.step].push(p.id);
  }
  return q;
}
function links() {
  const q = overrides();
  const base = location.href.replace(/merchant\.html.*$/, '');
  const qs = new URLSearchParams({ store: state.store });
  const attrs = [`data-store="${state.store}"`];
  for (const k of ['off', 'am', 'pm', 'both']) if (q[k].length) { qs.set(k, q[k].join(',')); attrs.push(`data-${k}="${q[k].join(',')}"`); }
  $('preview').href = `${base}?${qs}`;
  $('embed').textContent = `<script src="${base}embed.js" ${attrs.join(' ')} async></script>`; // textContent: no escaping needed
}
