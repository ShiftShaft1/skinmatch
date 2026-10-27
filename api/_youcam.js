// Server-side helpers for the YouCam AI Skin Analysis V2 API.
// The API key lives only in the YOUCAM_API_KEY env var; it never reaches the browser.

export const BASE = 'https://yce-api-01.makeupar.com/s2s/v2.0';
export const SD_ACTIONS = ['acne', 'pore', 'texture', 'moisture', 'oiliness', 'redness', 'radiance', 'dark_circle_v2', 'age_spot', 'wrinkle'];

export function apiKey() {
  return process.env.YOUCAM_API_KEY || '';
}

export async function yc(path, { method = 'GET', body } = {}) {
  const r = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || (data.status && data.status !== 200)) {
    const err = new Error(data.error || `YouCam HTTP ${r.status}`);
    err.code = data.error_code || 'youcam_error';
    err.status = r.status;
    throw err;
  }
  return data.data;
}

// ponytail: in-memory limits reset per serverless instance; the hard ceiling is the
// prepaid YouCam unit balance (no overage billing). Move to Upstash/KV if traffic grows.
const hits = new Map();
let day = '', dayCount = 0;
export function rateLimit(ip) {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== day) { day = today; dayCount = 0; hits.clear(); }
  const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) >= 0 && v !== '' && v != null ? Number(v) : d); // fail closed to defaults
  const cap = num(process.env.DAILY_CAP, 100);
  const perIp = num(process.env.PER_IP_PER_DAY, 6);
  const n = hits.get(ip) || 0;
  if (dayCount >= cap) return 'The demo has reached today\'s analysis limit. Try the sample instead.';
  if (n >= perIp) return 'You have used all your analyses for today. Try the sample instead.';
  hits.set(ip, n + 1); dayCount++;
  return null;
}

// x-real-ip is set by Vercel's edge and cannot be supplied by the client; a client-sent
// x-forwarded-for first hop can be. Fall back to the LAST forwarded hop (added by our proxy).
export function clientIp(req) {
  const real = req.headers['x-real-ip'];
  if (real) return String(real).trim();
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',').map(s => s.trim()).filter(Boolean);
  return fwd.at(-1) || req.socket?.remoteAddress || 'unknown';
}

const FRIENDLY = {
  error_below_min_image_size: 'That photo is too small. Use a photo at least 480 px wide.',
  error_exceed_max_image_size: 'That photo is too large. Try a smaller one.',
  error_src_face_too_small: 'Move closer: your face should fill most of the frame.',
  error_src_face_out_of_bound: 'Center your face in the frame and try again.',
  error_lighting_dark: 'The photo is too dark. Face a window or a lamp and try again.',
};
export function friendly(code, fallback) {
  return FRIENDLY[code] || fallback || 'Analysis failed. Try another photo.';
}
