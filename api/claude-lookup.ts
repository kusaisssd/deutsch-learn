/**
 * Vercel Serverless Function — /api/claude-lookup
 *
 * يستدعي Claude API عبر HTTP مباشرةً (بلا SDK).
 * المفتاح ANTHROPIC_API_KEY يُضبَط في Vercel Dashboard →
 *   Project → Settings → Environment Variables.
 * لا يظهر أبداً في المتصفّح — يبقى على الخادم.
 *
 * الاستخدام من الواجهة:
 *   GET /api/claude-lookup?word=Haus
 * يُرجع JSON منظّم قابل للعرض مباشرةً.
 */

export const config = { runtime: 'edge' };

// ─── حماية بسيطة: تحديد بسيط للاستخدام لكل IP (per warm instance) ───
const HITS = new Map<string, number[]>();
const RATE_LIMIT_MAX = 30;      // 30 طلب
const RATE_LIMIT_WINDOW = 60_000; // خلال دقيقة

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (HITS.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW);
  arr.push(now);
  HITS.set(ip, arr);
  return arr.length > RATE_LIMIT_MAX;
}

interface ClaudeResponse {
  content?: Array<{ type: string; text: string }>;
  error?: { type: string; message: string };
}

const PROMPT_BASIC = (word: string) => `Du bist ein Deutschlehrer für arabischsprachige Lernende.
Der Lerner sucht: "${word}"

Antworte NUR mit einem JSON-Objekt (ohne Markdown, ohne Codeblock-Fences) mit folgendem Schema:
{
  "word": "die korrekte Schreibweise (falls Tippfehler, korrigiert)",
  "type": "noun" | "verb" | "adjective" | "adverb" | "phrase" | "other",
  "article": "der" | "die" | "das" | null,
  "arabicTranslation": "die wichtigste arabische Übersetzung, kurz",
  "meanings": [
    { "de": "Bedeutung/Definition auf Deutsch", "ar": "arabische Übersetzung dieser Bedeutung" }
  ],
  "examples": [
    { "de": "Beispielsatz auf Deutsch", "ar": "arabische Übersetzung des Satzes" }
  ],
  "grammar": "kurzer Grammatikhinweis auf Arabisch (z. B. فعل منفصل، مع Dativ دائماً) oder null",
  "synonyms": ["deutsches Synonym 1", "deutsches Synonym 2"],
  "usage": "kultureller Hinweis oder Alltagsgebrauch auf Arabisch, oder null"
}

Gib 2-3 Bedeutungen und 2-3 vielfältige Beispielsätze. Sei präzise und lehrreich.
Falls das Wort keine deutsche Bedeutung hat, gib type:"other" und erkläre kurz.`;

/**
 * PROMPT_ASK — سؤال مفتوح حول كلمة/جملة.
 * يُرجع JSON بحقل واحد فقط "answer" باللغة العربية (شرح واضح مع أمثلة عند اللزوم).
 * الأمثلة الألمانية داخل النص تبقى بالألمانية بين علامتَي «».
 */
const PROMPT_ASK = (word: string, question: string) =>
  `Du bist ein hilfsbereiter Deutschlehrer für arabischsprachige Lernende.
Der Lerner betrachtet das deutsche Wort/den Ausdruck: "${word}"
und stellt folgende Frage (auf Arabisch): "${question}"

Antworte NUR mit einem JSON-Objekt (ohne Markdown, ohne Codeblock-Fences):
{
  "answer": "eine klare, hilfreiche Antwort auf ARABISCH; deutsche Beispielsätze bleiben deutsch und stehen in Anführungszeichen »…«; nutze Absätze mit \\n\\n wenn nötig; sei präzise und lehrreich; wenn die Frage nach Beispielen fragt, gib 3-5 vielfältige Sätze mit ihrer arabischen Übersetzung; wenn die Frage nach Konjugation fragt, gib eine kurze übersichtliche Tabelle."
}`;

const PROMPT_DEEP = (word: string) => `Du bist ein Deutschlehrer für arabischsprachige Lernende und lieferst
eine VERTIEFTE Erklärung des Wortes/Ausdrucks "${word}".

Antworte NUR mit einem JSON-Objekt (ohne Markdown, ohne Codeblock-Fences) mit diesem Schema:
{
  "word": "das Wort",
  "deeperExamples": [
    { "de": "längerer, kontextreicher Beispielsatz", "ar": "arabische Übersetzung", "context": "kurze Situation/Kontext auf Arabisch" }
  ],
  "culturalContext": "kultureller Hintergrund oder Nutzungsraum auf Arabisch, oder null",
  "commonMistakes": "häufige Fehler von arabischsprachigen Lernenden mit diesem Wort auf Arabisch, oder null",
  "relatedPhrases": [
    { "de": "verwandte Redewendung oder Ausdruck", "ar": "arabische Übersetzung/Erklärung" }
  ]
}

Gib 3-4 vertiefte Beispiele und 3-4 verwandte Redewendungen.`;

export default async function handler(req: Request): Promise<Response> {
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json', ...cors },
    });
  }

  const url = new URL(req.url);
  const word = url.searchParams.get('word')?.trim();
  const modeParam = url.searchParams.get('mode');
  const mode: 'basic' | 'deep' | 'ask' =
    modeParam === 'deep' ? 'deep' : modeParam === 'ask' ? 'ask' : 'basic';
  const question = url.searchParams.get('q')?.trim() ?? '';

  if (!word || word.length < 2 || word.length > 200) {
    return new Response(JSON.stringify({ error: 'Ungültiger Parameter "word" (2–200 Zeichen erforderlich).' }), {
      status: 400,
      headers: { 'content-type': 'application/json', ...cors },
    });
  }
  if (mode === 'ask' && (question.length < 2 || question.length > 500)) {
    return new Response(JSON.stringify({ error: 'Ungültiger Parameter "q" (2–500 Zeichen erforderlich für mode=ask).' }), {
      status: 400,
      headers: { 'content-type': 'application/json', ...cors },
    });
  }

  // Rate limit per IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (rateLimited(ip)) {
    return new Response(JSON.stringify({ error: 'Zu viele Anfragen. Bitte warte einen Moment.' }), {
      status: 429,
      headers: { 'content-type': 'application/json', ...cors },
    });
  }

  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    return new Response(JSON.stringify({
      error: 'Der Server ist nicht konfiguriert (ANTHROPIC_API_KEY fehlt in Vercel).',
    }), {
      status: 500,
      headers: { 'content-type': 'application/json', ...cors },
    });
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: mode === 'deep' ? 1400 : mode === 'ask' ? 1200 : 1024,
        messages: [{
          role: 'user',
          content: mode === 'deep' ? PROMPT_DEEP(word)
                 : mode === 'ask'  ? PROMPT_ASK(word, question)
                 : PROMPT_BASIC(word),
        }],
      }),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return new Response(JSON.stringify({
        error: `Claude API Fehler (${upstream.status})`,
        detail: text.slice(0, 500),
      }), {
        status: 502,
        headers: { 'content-type': 'application/json', ...cors },
      });
    }

    const data = (await upstream.json()) as ClaudeResponse;
    const raw = data.content?.[0]?.text ?? '';
    // strip markdown fences if any
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return new Response(JSON.stringify({
        error: 'Claude hat kein gültiges JSON zurückgegeben.',
        raw: cleaned.slice(0, 500),
      }), {
        status: 502,
        headers: { 'content-type': 'application/json', ...cors },
      });
    }

    // نطبّق cache على basic/deep فقط — أسئلة الـ ask مخصّصة و لا يجب مشاركتها
    const cacheHeader = mode === 'ask'
      ? 'no-store'
      : 'public, s-maxage=86400, stale-while-revalidate=604800';

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': cacheHeader,
        ...cors,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: 'Serverfehler', detail: msg }), {
      status: 500,
      headers: { 'content-type': 'application/json', ...cors },
    });
  }
}
