// GET ?id=<task_id> -> { status: "running" } | { status: "success", output: [{ type, ui_score, raw_score, mask_urls }] }
import { yc, apiKey, friendly } from './_youcam.js';

export default async function handler(req, res) {
  if (!apiKey()) return res.status(503).json({ error: 'Live analysis is not configured.', demo: true });
  const id = String(req.query.id || '');
  if (!/^[A-Za-z0-9_\-+/=]{10,200}$/.test(id)) return res.status(400).json({ error: 'Bad task id.' });

  try {
    const data = await yc(`/task/skin-analysis/${encodeURIComponent(id)}`);
    if (data.task_status === 'success') {
      return res.status(200).json({ status: 'success', output: data.results?.output || [] });
    }
    if (data.task_status === 'error') {
      return res.status(200).json({ status: 'error', error: friendly(data.error, data.error) });
    }
    return res.status(200).json({ status: 'running' });
  } catch (e) {
    return res.status(502).json({ status: 'error', error: friendly(e.code, e.message) });
  }
}
