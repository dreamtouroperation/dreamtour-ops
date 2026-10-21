// Guide marks: "вышел" / "не вышел" for each guest in a vehicle. The office (admin) can mark too.
// Guests are identified by a short hash, never by name. Each guide writes only to his own record,
// so two guides marking at the same moment never overwrite each other.
// Reading needs a guide key or the admin key.
import { store, sha256, json, adminHash, currentData } from '../lib/common.mjs';

async function who(st, req, key) {
  if (typeof key !== 'string' || key.length < 32) return null;
  const h = await sha256(key);
  if (h === (await adminHash(st))) return { role: 'admin' };
  const data = await currentData(st, req);
  const auth = (data && data.markAuth) || {};
  const id = Object.keys(auth).find((g) => auth[g] === h);
  return id ? { role: 'guide', id } : null;
}

async function allMarks(st) {
  const out = {};
  const { blobs } = await st.list({ prefix: 'marks/' });
  const lists = await Promise.all(blobs.map((b) => st.get(b.key, { type: 'json' })));
  // the latest mark wins when a guide and the office marked the same guest
  lists.forEach((m) => { if (m) Object.keys(m).forEach((id) => { if (!out[id] || String(m[id].t) > String(out[id].t)) out[id] = m[id]; }); });
  return out;
}

export default async (req) => {
  const st = store();

  if (req.method === 'GET') {
    const w = await who(st, req, req.headers.get('x-dt-key'));
    if (!w) return json({ error: 'forbidden' }, 403);
    return json({ marks: await allMarks(st), at: new Date().toISOString() });
  }

  if (req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }
    const w = await who(st, req, body.key);
    if (!w) return json({ error: 'forbidden' }, 403);
    const owner = w.role === 'admin' ? 'office' : w.id;
    const items = Array.isArray(body.items) ? body.items.slice(0, 500) : [];
    const mine = (await st.get('marks/' + owner, { type: 'json' })) || {};
    for (const it of items) {
      if (!it || typeof it.id !== 'string' || !/^[0-9a-f]{8,40}$/.test(it.id)) continue;
      const t = typeof it.t === 'string' ? it.t.slice(0, 30) : new Date().toISOString();
      // clearing is stored as an empty mark so it can win over an older mark from someone else
      mine[it.id] = it.s === 'out' || it.s === 'no' ? { s: it.s, g: owner, t } : { s: '', g: owner, t };
    }
    await st.setJSON('marks/' + owner, mine);
    return json({ ok: true, count: Object.keys(mine).length });
  }

  return json({ error: 'method_not_allowed' }, 405);
};

export const config = { path: '/api/marks' };
