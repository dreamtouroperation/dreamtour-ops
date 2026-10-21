// Dream Tour data API. Everything stored here is already encrypted in the browser
// (tourist groups by group code, guides by guide code, the admin copy by the admin password).
// The server only checks that a write comes from someone who knows the admin password.
import { store, sha256, json, adminHash } from '../lib/common.mjs';

const MAX_BYTES = 8 * 1024 * 1024;

export default async (req) => {
  const st = store();

  if (req.method === 'GET') {
    const data = await st.get('data', { type: 'json' });
    return data ? json(data) : json({ error: 'empty' }, 404);
  }

  if (req.method === 'PUT') {
    const raw = await req.text();
    if (raw.length > MAX_BYTES) return json({ error: 'too_large' }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: 'bad_json' }, 400); }
    if (typeof body.writeKey !== 'string' || (await sha256(body.writeKey)) !== (await adminHash(st))) return json({ error: 'forbidden' }, 403);
    const d = body.data;
    if (!d || !d.admin || !d.tagSalt || !Array.isArray(d.groups)) return json({ error: 'bad_data' }, 400);

    const prev = await st.get('data', { type: 'json' });
    if (prev) await st.setJSON('backup/' + new Date().toISOString(), prev);
    await st.setJSON('data', d);
    if (typeof body.newWriteHash === 'string' && /^[0-9a-f]{64}$/.test(body.newWriteHash)) await st.set('auth', body.newWriteHash);
    return json({ ok: true, updated: d.updated });
  }

  return json({ error: 'method_not_allowed' }, 405);
};

export const config = { path: '/api/data' };
