// POST { image: "data:image/jpeg;base64,..." } -> { task_id }
// Uploads the selfie to YouCam (file API + pre-signed PUT) and starts an SD skin analysis task.
import { yc, apiKey, rateLimit, clientIp, friendly, SD_ACTIONS } from './_youcam.js';

const MAX_BYTES = 3 * 1024 * 1024;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!apiKey()) return res.status(503).json({ error: 'Live analysis is not configured. Try the sample.', demo: true });

  const m = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(req.body?.image || '');
  if (!m) return res.status(400).json({ error: 'Send a JPEG or PNG photo.' });
  const bytes = Buffer.from(m[2], 'base64');
  if (bytes.length > MAX_BYTES) return res.status(413).json({ error: 'Photo is too large (max 3 MB).' });

  const limited = rateLimit(clientIp(req));
  if (limited) return res.status(429).json({ error: limited });

  try {
    const contentType = m[1];
    const file = (await yc('/file/skin-analysis', {
      method: 'POST',
      body: { files: [{ content_type: contentType, file_name: `selfie.${contentType === 'image/png' ? 'png' : 'jpg'}`, file_size: bytes.length }] },
    })).files[0];
    const put = file.requests[0];
    const up = await fetch(put.url, { method: put.method || 'PUT', headers: put.headers, body: bytes });
    if (!up.ok) throw Object.assign(new Error(`Upload failed (${up.status})`), { code: 'upload_failed' });

    const task = await yc('/task/skin-analysis', {
      method: 'POST',
      body: { src_file_id: file.file_id, dst_actions: SD_ACTIONS, miniserver_args: { enable_mask_overlay: false }, format: 'json' },
    });
    return res.status(200).json({ task_id: task.task_id });
  } catch (e) {
    return res.status(502).json({ error: friendly(e.code, e.message), code: e.code });
  }
}
