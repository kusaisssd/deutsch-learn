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

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * قائمة السماح: قائمة SHA-256 مفصولة بفواصل تمرّرها في env AUTHORIZED_HASHES.
 * إن لم تُضبَط → أي passphrase (6+ أحرف) يعمل.
 * إن ضُبطت → فقط الـ passphrases التي تطابق بصمتها القائمةَ تعمل.
 */
async function authorized(passphrase: string): Promise<boolean> {
  const whitelist = process.env['AUTHORIZED_HASHES']?.trim();
  if (!whitelist) return true; // لا قائمة → السماح لأيّ passphrase صالح
  const hash = await sha256Hex(passphrase);
  return whitelist.split(',').map(s => s.trim().toLowerCase()).includes(hash);
}

interface ClaudeResponse {
  content?: Array<{ type: string; text: string }>;
  error?: { type: string; message: string };
}

/**
 * PROMPT_BASIC — الأدنى الممكن (توكنز قليلة).
 * فقط: الترجمة العربية + مثال واحد قصير. أيّ شيء إضافي (شرح، أمثلة أكثر،
 * تصريف، إلخ) يُطلب لاحقاً عبر mode=ask بضغطة زرّ.
 */
const PROMPT_BASIC = (word: string) => `Du bist ein Deutschlehrer für arabischsprachige Lernende.
Der Lerner sucht: "${word}"

Antworte NUR mit einem JSON-Objekt (ohne Markdown, ohne Codeblock-Fences), knapp:
{
  "word": "die korrekte Schreibweise (bei Tippfehler korrigiert)",
  "type": "noun" | "verb" | "adjective" | "adverb" | "phrase" | "other",
  "article": "der" | "die" | "das" | null,
  "arabicTranslation": "die wichtigste arabische Übersetzung, sehr kurz",
  "examples": [
    { "de": "EIN kurzer Beispielsatz auf Deutsch", "ar": "arabische Übersetzung" }
  ]
}

Gib GENAU 1 kurzen Beispielsatz. KEINE meanings, KEINE synonyms, KEINE grammar,
KEINE usage — der Lerner fragt bei Bedarf gezielt danach. Sei minimal und präzise.`;

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

/**
 * PROMPT_ANALYZE — تحليل نصّ ألماني كامل كـ«درس» منظّم.
 * يُرجَع JSON خالص بالبنية الموصوفة أدناه.
 */
const PROMPT_ANALYZE = (text: string) => `Du bist ein erfahrener Deutschlehrer für arabischsprachige Lernende auf B1-Niveau.
Analysiere den folgenden deutschen Text und erzeuge daraus eine strukturierte Lerneinheit.

TEXT:
"""
${text}
"""

Antworte NUR mit einem gültigen JSON-Objekt (ohne Markdown, ohne Codeblock-Fences, ohne Vor- oder Nachwort) nach genau diesem Schema:

{
  "zusammenfassung": "ملخّص عربي قصير (2-3 جمل) لمضمون النصّ",
  "textsorte": "Nachrichtentext | Blogbeitrag | Dialog | Erfahrungsbericht | Werbetext | Essay | Rezension | Mail | Anderes",
  "niveau": "A2 | B1 | B2 | C1",
  "wortzahl": number,
  "redewendungen": [
    { "phrase": "deutsche feste Redewendung oder vollständige Phrase (NICHT nur ein Wort)",
      "ar": "الترجمة العربيّة الدقيقة",
      "erklaerungAr": "شرح متى تُستعمل بالعربيّة",
      "satz": "die vollständige Satzzeile aus dem Text, in der sie vorkam" }
  ],
  "schluesselwoerter": [
    { "wort": "wichtiges Nomen oder Adjektiv aus dem Text",
      "artikel": "der | die | das",
      "ar": "الترجمة",
      "satz": "die Satzzeile aus dem Text" }
  ],
  "verben": [
    { "infinitiv": "Verb-Infinitiv (z. B. erreichen)",
      "partizip": "Partizip II (erreicht)",
      "praeposition": "feste Präposition falls vorhanden, z. B. sprechen über (A), sonst leerer String",
      "ar": "الترجمة",
      "satz": "die Satzzeile aus dem Text" }
  ],
  "grammatikfokus": {
    "thema": "die dominante Grammatik im Text (z. B. Perfekt, Passiv, Konjunktiv II, Relativsätze, Modalverben)",
    "erklaerungAr": "شرح موجز بالعربيّة (3-5 جمل) للقاعدة مع مثال من النصّ"
  },
  "hinweise": [
    { "typ": "False Friend | Besonderheit | Umgangssprache | Grammatikfalle",
      "beschreibung": "تنبيه بالعربيّة لنقطة قد يخطئ فيها المتعلّم" }
  ],
  "verstaendnisfragen": [
    { "frage": "سؤال فهم بالعربيّة", "antwort": "الإجابة بالعربيّة" }
  ],
  "lernziele": [
    "هدف تعلّم 1 عربي (مثلاً: استعمال Perfekt مع sein)",
    "هدف تعلّم 2 عربي",
    "هدف تعلّم 3 عربي"
  ]
}

Qualitätsanforderungen (sehr wichtig):
- 3-6 Redewendungen (vollständige Phrasen, NICHT einzelne Wörter)
- 8-15 Schlüsselwörter (die TATSÄCHLICH im Text sind)
- 5-10 Verben (die TATSÄCHLICH im Text sind)
- 2-4 Hinweise
- 3 Verständnisfragen
- Alle "satz"-Felder enthalten einen echten Satzausschnitt AUS dem Text
- Niveau-Angabe realistisch (nicht alles automatisch B2)
- Für arabischsprachige B1-Lernende: einfache arabische Erklärungen, nicht zu literarisch`;

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
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-sync-key',
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json', ...cors },
    });
  }

  // ─── تحقّق من الـ passphrase: بلا passphrase → منع الوصول ───
  const passphrase = req.headers.get('x-sync-key')?.trim() ?? '';
  if (passphrase.length < 6) {
    return new Response(JSON.stringify({
      error: 'AI مقفَل: يجب ضبط passphrase من صفحة الإعدادات لاستخدام Claude.',
    }), {
      status: 401,
      headers: { 'content-type': 'application/json', ...cors },
    });
  }
  if (!(await authorized(passphrase))) {
    return new Response(JSON.stringify({
      error: 'Passphrase غير مصرَّح به لاستخدام AI على هذا الخادم.',
    }), {
      status: 403,
      headers: { 'content-type': 'application/json', ...cors },
    });
  }

  // ─── قراءة البارامترات من query (GET) أو JSON body (POST) ───
  let word: string | undefined;
  let modeParam: string | null = null;
  let question = '';

  if (req.method === 'POST') {
    try {
      const body = await req.json() as { word?: string; mode?: string; q?: string };
      word = body.word?.trim();
      modeParam = body.mode ?? null;
      question = body.q?.trim() ?? '';
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body.' }), {
        status: 400,
        headers: { 'content-type': 'application/json', ...cors },
      });
    }
  } else {
    const url = new URL(req.url);
    word = url.searchParams.get('word')?.trim();
    modeParam = url.searchParams.get('mode');
    question = url.searchParams.get('q')?.trim() ?? '';
  }

  const mode: 'basic' | 'deep' | 'ask' | 'analyze' =
    modeParam === 'deep' ? 'deep'
    : modeParam === 'ask' ? 'ask'
    : modeParam === 'analyze' ? 'analyze'
    : 'basic';

  // في وضع analyze يُستعمل الحقل word كـ «نصّ كامل» و بحدود أطول (5000 حرف)
  if (mode === 'analyze') {
    if (!word || word.length < 50 || word.length > 5000) {
      return new Response(JSON.stringify({ error: 'النصّ قصير جداً أو طويل جداً (50 - 5000 حرف).' }), {
        status: 400,
        headers: { 'content-type': 'application/json', ...cors },
      });
    }
  } else if (!word || word.length < 2 || word.length > 200) {
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
        max_tokens: mode === 'analyze' ? 3500
                 : mode === 'deep'    ? 1400
                 : mode === 'ask'     ? 1200
                 : 350,
        messages: [{
          role: 'user',
          content: mode === 'analyze' ? PROMPT_ANALYZE(word!)
                 : mode === 'deep'   ? PROMPT_DEEP(word!)
                 : mode === 'ask'    ? PROMPT_ASK(word!, question)
                 : PROMPT_BASIC(word!),
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

    // نطبّق cache على basic/deep فقط — ask و analyze مخصّصان لكل نصّ
    const cacheHeader = (mode === 'ask' || mode === 'analyze')
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
