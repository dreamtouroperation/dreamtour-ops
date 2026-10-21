import { getStore } from '@netlify/blobs';

// sha256 of the write key derived from the first admin password. After the admin changes
// the password in the app, the new hash is kept in Blobs ("auth") and this one is no longer used.
export const INITIAL_WRITE_HASH = '56a081deb553d4bf1668fed22c2f51f136dbe8416bf4c128db21ad07e307b5fe';

export const store = () => getStore({ name: 'dreamtour', consistency: 'strong' });

export const sha256 = async (s) => {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export const adminHash = async (st) => (await st.get('auth')) || INITIAL_WRITE_HASH;

// Published data, or the seed shipped with the site before the first publish.
export const currentData = async (st, req) => {
  const d = await st.get('data', { type: 'json' });
  if (d) return d;
  try { const r = await fetch(new URL('/seed.json', req.url)); return r.ok ? await r.json() : null; } catch { return null; }
};
