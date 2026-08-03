/**
 * Vercel Serverless Function — /api/sync
 *
 * مزامنة سحابية بسيطة بـ passphrase (بلا تسجيل حساب).
 *
 * كيف تعمل:
 *   - العميل يرسل passphrase في header `x-sync-key`
 *   - على الخادم: نُحسب SHA-256 للـ passphrase و نستخدمه مفتاحاً في KV
 *     (فلا يُخزَّن الـ passphrase نفسه، بل بصمته)
 *   - GET  → يُرجع آخر blob محفوظ (أو null)
 *   - POST → يستقبل blob كاملاً و يحفظه
 *
 * الإعداد المطلوب في Vercel (مرّة واحدة):
 *   1) Dashboard → Storage → Create Database → KV (أو Upstash Redis)
 *   2) Vercel يُضيف تلقائياً متغيّرات: KV_REST_API_URL, KV_REST_API_TOKEN
 *      (أو UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN لو من Upstash مباشرة)
 *   3) Redeploy
 */

export const config = { runtime: 'edge' };

const KV_URL =
  () => process.env['KV_REST_API_URL'] ?? process.env['UPSTASH_REDIS_REST_URL'];
const KV_TOKEN =
  () => process.env['KV_REST_API_TOKEN'] ?? process.env['UPSTASH_REDIS_REST_TOKEN'];

async function kvGet(key: string): Promise<string | null> {
  const url = KV_URL(); const token = KV_TOKEN();
  if (!url || !token) throw new Error('KV not configured');
  const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`KV get failed: ${res.status}`);
  const data = (await res.json()) as { result: string | null };
  return data.result ?? null;
}

async function kvSet(key: string, value: string): Promise<void> {
  const url = KV_URL(); const token = KV_TOKEN();
  if (!url || !token) throw new Error('KV not configured');
  // ex=31536000 → انتهاء صلاحيّة بعد سنة إن لم يُحدَّث (يمنع تراكم البيانات المهجورة)
  const res = await fetch(`${url}/set/${encodeURIComponent(key)}?ex=31536000`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' },
    body: value,
  });
  if (!res.ok) throw new Error(`KV set failed: ${res.status}`);
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const MAX_PAYLOAD = 5 * 1024 * 1024; // 5 MB

export default async function handler(req: Request): Promise<Response> {
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-sync-key',
  };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const syncKey = req.headers.get('x-sync-key')?.trim() ?? '';
  if (syncKey.length < 6) {
    return json(400, { error: 'Missing or too short sync key (min 6 chars).' }, cors);
  }
  if (syncKey.length > 200) {
    return json(400, { error: 'Sync key too long.' }, cors);
  }

  if (!KV_URL() || !KV_TOKEN()) {
    return json(500, {
      error: 'Cloud sync ist auf dem Server nicht konfiguriert.',
      detail: 'Erstelle in Vercel Dashboard → Storage → KV eine Datenbank und deploye neu.',
    }, cors);
  }

  const kvKey = `sync:${await sha256Hex(syncKey)}`;

  try {
    if (req.method === 'GET') {
      const raw = await kvGet(kvKey);
      return new Response(raw ?? 'null', {
        status: 200,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...cors },
      });
    }

    if (req.method === 'POST') {
      const body = await req.text();
      if (body.length > MAX_PAYLOAD) {
        return json(413, { error: 'Payload too large (>5MB).' }, cors);
      }
      // نتحقّق أنه JSON صالح
      try { JSON.parse(body); }
      catch { return json(400, { error: 'Body is not valid JSON.' }, cors); }
      await kvSet(kvKey, body);
      return json(200, { ok: true, size: body.length }, cors);
    }

    return json(405, { error: 'Method not allowed' }, cors);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json(500, { error: 'Server error', detail: msg }, cors);
  }
}

function json(status: number, obj: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', ...cors },
  });
}
