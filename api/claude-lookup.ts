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

export const config = { runtime: 'edge', maxDuration: 60 };

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
 * PROMPT_GENERATE — توليد نصّ ألماني بمستوى و نوع مُحدَّدَين.
 */
const SORTEN_LABELS: Record<string, string> = {
  nachricht: 'kurzer Zeitungsartikel / Nachrichtenmeldung',
  dialog: 'Alltagsdialog zwischen 2-3 Personen',
  meinung: 'persönlicher Meinungsartikel / Kolumne',
  erfahrung: 'Erfahrungsbericht in Ich-Form (Blog-Stil)',
  wissenschaft: 'Wissenschafts- oder Technikartikel (populärwissenschaftlich)',
  rezension: 'kurze Rezension (Film, Buch, Produkt oder Ort)',
};
const PROMPT_GENERATE = (niveau: string, textsorte: string) => `Du bist ein kreativer Deutschlehrer.
Erzeuge einen originalen deutschen Text auf Niveau ${niveau}, Typ: ${SORTEN_LABELS[textsorte] ?? textsorte}.

Vorgaben:
- Länge: ca. 180-230 Wörter (unbedingt UNTER 2000 Zeichen)
- Natürliche, zeitgemäße Sprache für Erwachsene
- Grammatik und Wortschatz genau passend zu Niveau ${niveau}:
  ${niveau === 'A2' ? '— einfache Haupt- und Nebensätze, Perfekt, grundlegende Konnektoren (weil, dass, wenn)'
    : niveau === 'B1' ? '— verschiedene Zeitformen, Nebensätze (weil, dass, obwohl, wenn, als), Modalverben, Relativsätze einfach'
    : niveau === 'B2' ? '— Konjunktiv II, Passiv, erweiterte Nebensätze, feste Präpositionen, idiomatische Phrasen'
    : '— Konjunktiv I/II, Nominalstil, komplexe Nebensätze, fortgeschrittener Wortschatz, feste Wendungen'}
- Jeder Text ist thematisch frisch und anders als übliche Beispiele
- WICHTIG: Variiere das Thema stark bei jeder Generierung (verwende diesen Seed: ${Date.now()})

Antworte NUR mit einem JSON-Objekt (ohne Markdown, ohne Preamble):
{
  "titel": "kurzer Titel (max. 8 Wörter)",
  "text": "der eigentliche deutsche Text"
}`;

/**
 * PROMPT_ANALYZE — تحليل مختصر و سريع لتفادي الـ timeout.
 */
const PROMPT_ANALYZE = (text: string) => `Du bist ein Deutschlehrer für arabischsprachige B1-Lerner.
Analysiere den Text und erzeuge eine KOMPAKTE Lerneinheit.

⚠️ KRITISCH — AUSGABEFORMAT:
Antworte ausschließlich mit EINEM einzigen JSON-Objekt. KEIN Vortext,
KEIN Nachtext, KEINE Erklärung, KEINE Markdown-Fences. Die Antwort muss
mit "{" beginnen und mit "}" enden. ALLE Klammern vollständig schließen.
Verwende KEINE trailing commas. Alle Strings in doppelten Anführungszeichen.
Prüfe am Ende dein JSON auf Gültigkeit.

⚠️ KRITISCH — SPRACHE:
Alle Felder mit "Ar" im Namen (zusammenfassung, ar, erklaerungAr, empfehlungAr,
beschreibung, uebungsidee, frage, antwort, aspekt, lernziele) müssen auf
ARABISCH geschrieben sein, NICHT auf Deutsch. Fachbegriffe (Perfekt, Passiv…)
und Vokabeln bleiben deutsch; die Erklärung und der Fließtext sind arabisch.

TEXT:
"""
${text}
"""

Schema (genau diese Felder, keine zusätzlichen):

{
  "zusammenfassung": "ملخّص عربي في جملتين قصيرتين",
  "textsorte": "Nachrichtentext | Blog | Dialog | Essay | Mail | Anderes",
  "niveau": "A2 | B1 | B2 | C1",
  "wortzahl": number,
  "redewendungen": [
    { "phrase": "vollständige Phrase (keine Einzelwörter)", "ar": "ترجمة قصيرة", "satz": "kurze Satzzeile aus Text" }
  ],
  "schluesselwoerter": [
    { "wort": "Nomen oder Adjektiv", "artikel": "der|die|das", "ar": "ترجمة", "satz": "kurze Satzzeile" }
  ],
  "verben": [
    { "infinitiv": "verb", "partizip": "PII", "praeposition": "", "ar": "ترجمة", "satz": "kurze Satzzeile" }
  ],
  "grammatikfokus": {
    "thema": "dominante Grammatik",
    "erklaerungAr": "شرح عربي موجز في 2-3 جمل"
  },
  "hinweise": [
    { "typ": "Besonderheit", "beschreibung": "ملاحظة عربيّة قصيرة" }
  ],
  "verstaendnisfragen": [
    { "frage": "سؤال", "antwort": "جواب قصير" }
  ],
  "lernziele": ["هدف 1", "هدف 2"],
  "niveauentwicklung": [
    { "aspekt": "konkreter Skill oder Grammatik-Punkt",
      "empfehlungAr": "توصية عملية بالعربيّة لتطوير هذا الجانب (2-3 جمل قصيرة)",
      "uebungsidee": "اقتراح تمرين سريع لتدريب هذا الجانب" }
  ]
}

Mengen (unbedingt einhalten — kurze Antwort, kein Overflow):
- redewendungen: GENAU 3 (vollständige Phrasen, nicht Einzelwörter)
- schluesselwoerter: GENAU 6
- verben: GENAU 5
- hinweise: GENAU 2
- verstaendnisfragen: GENAU 3
- lernziele: GENAU 2
- niveauentwicklung: GENAU 3 (توصيات عمليّة محدّدة لرفع المستوى حتى يصبح قادراً على فهم نصوص كهذه بنفسه)
- Alle Felder EXTREM KURZ. KEINE Erklärungen länger als 15 Wörter.
- "satz"-Felder NUR 1 Satz (max. 12 Wörter), nicht ganze Paragraphen.
- "ar"-Felder: eine kurze arabische Übersetzung (max. 8 Wörter), KEINE Erklärungen.
- "empfehlungAr" & "uebungsidee": je 1-2 Sätze maximal, KEINE Aufzählungen.
- "zusammenfassung": GENAU 2 Sätze, keine Einleitung wie "في هذا النصّ".
- Gesamtlänge der Antwort: unbedingt UNTER 2000 Zeichen bleiben.

Besonders wichtig für niveauentwicklung:
Identifiziere die 3 KONKRETEN Schwierigkeiten in diesem Text (z. B. Konnektoren,
Perfekt-Formen, zusammengesetzte Nomen, idiomatische Phrasen, Konjunktiv II) und
gib für JEDE eine praktische Empfehlung, WAS der Lerner üben soll, damit er beim
nächsten Text dieser Art nicht mehr stolpert. Jede Empfehlung soll konkret und
umsetzbar sein, nicht generisch wie "mehr lesen".

AUSWAHL-KRITERIEN — SEHR WICHTIG:
Wähle für schluesselwoerter und verben die SCHWIEREN / FORTGESCHRITTENEN Wörter,
NICHT die einfachen Alltagswörter. Konkret:

❌ ÜBERSPRINGE triviale A1/A2-Wörter wie: haben, sein, gehen, machen, kommen,
   gut, viel, Haus, Mann, Frau, Tag, Jahr, Zeit, Mensch, Kind, Problem.

✅ WÄHLE anspruchsvollere Wörter (B1 aufwärts), die der Lerner wahrscheinlich
   NICHT kennt: präzise Nomen, abstrakte Begriffe, idiomatische Verben,
   Fachwortschatz, Modalpartikel, zusammengesetzte Verben, Wörter mit festen
   Präpositionen, Nomen mit untypischem Artikel.

Beispiel: statt "gehen" wähle "sich etwas aneignen" / "bevorstehen" / "zögern".
Statt "Haus" wähle "die Hürde" / "die Rückschau" / "die Verzahnung".

Für redewendungen bevorzuge echte feste Wendungen mit kultureller Bedeutung,
keine einfachen Satzverbindungen.`;

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

  // بارامترات mode=generate
  let genNiveau = 'B1';
  let genTextsorte = 'nachricht';

  if (req.method === 'POST') {
    try {
      const body = await req.json() as { word?: string; mode?: string; q?: string; niveau?: string; textsorte?: string };
      word = body.word?.trim();
      modeParam = body.mode ?? null;
      question = body.q?.trim() ?? '';
      if (body.niveau) genNiveau = body.niveau;
      if (body.textsorte) genTextsorte = body.textsorte;
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

  const mode: 'basic' | 'deep' | 'ask' | 'analyze' | 'generate' =
    modeParam === 'deep' ? 'deep'
    : modeParam === 'ask' ? 'ask'
    : modeParam === 'analyze' ? 'analyze'
    : modeParam === 'generate' ? 'generate'
    : 'basic';

  // في وضع generate لا نحتاج word
  if (mode === 'generate') {
    const validNiveau = ['A2', 'B1', 'B2', 'C1'].includes(genNiveau) ? genNiveau : 'B1';
    const validSorte = ['nachricht', 'dialog', 'meinung', 'erfahrung', 'wissenschaft', 'rezension'].includes(genTextsorte) ? genTextsorte : 'nachricht';
    genNiveau = validNiveau; genTextsorte = validSorte;
  } else if (mode === 'analyze') {
    if (!word || word.length < 50 || word.length > 2500) {
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
    // timeout: 50 ثانية (ضمن حدود Vercel Pro 60s + هامش أمان)
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 50_000);

    // max_tokens مُقنَّن حسب الوضع — analyze مختصر لتفادي الـ504
    const maxTokens = mode === 'analyze' ? 2600
                    : mode === 'generate' ? 900
                    : mode === 'deep'    ? 1400
                    : mode === 'ask'     ? 1200
                    : 350;

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        messages: [{
          role: 'user',
          content: mode === 'analyze'  ? PROMPT_ANALYZE(word!)
                 : mode === 'generate' ? PROMPT_GENERATE(genNiveau, genTextsorte)
                 : mode === 'deep'     ? PROMPT_DEEP(word!)
                 : mode === 'ask'      ? PROMPT_ASK(word!, question)
                 : PROMPT_BASIC(word!),
        }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

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

    // استخراج JSON بـ bracket-counting:
    // يبحث عن أوّل كتلة JSON ذات أقواس متوازنة (يتجاهل أي preamble/postamble
    // و أي أقواس ضمن strings).
    const extractJson = (text: string): string | null => {
      const start = text.indexOf('{');
      if (start < 0) return null;
      let depth = 0, inString = false, escape = false;
      for (let i = start; i < text.length; i++) {
        const c = text[i];
        if (escape) { escape = false; continue; }
        if (c === '\\') { escape = true; continue; }
        if (c === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth === 0) return text.slice(start, i + 1); }
      }
      return null;
    };

    let cleaned = raw.replace(/```(?:json)?/gi, '').trim();
    const extracted = extractJson(cleaned);
    if (extracted) cleaned = extracted;
    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1'); // trailing commas

    // إصلاح JSON المقطوع (إن نفد max_tokens): إغلاق string مفتوح و الأقواس المعلّقة
    const repairTruncated = (txt: string): string => {
      let s = txt;
      // عدّ علامات الاقتباس (خارج escape) لمعرفة إن كان هناك string مفتوح
      let inString = false, escape = false;
      let openBraces = 0, openBrackets = 0;
      for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (escape) { escape = false; continue; }
        if (c === '\\') { escape = true; continue; }
        if (c === '"') inString = !inString;
        else if (!inString) {
          if (c === '{') openBraces++;
          else if (c === '}') openBraces--;
          else if (c === '[') openBrackets++;
          else if (c === ']') openBrackets--;
        }
      }
      if (inString) s += '"';
      // قد يكون آخر field غير مكتمل («"foo":» بلا قيمة) → احذف
      s = s.replace(/,\s*"[^"]*"\s*:\s*$/, '');
      s = s.replace(/,\s*$/, '');
      while (openBrackets-- > 0) s += ']';
      while (openBraces-- > 0) s += '}';
      return s;
    };

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (firstErr) {
      // محاولة ثانية: أصلح JSON المقطوع
      try {
        const repaired = repairTruncated(cleaned);
        parsed = JSON.parse(repaired);
      } catch {
        // كلا المحاولتين فشلتا — أعد الخطأ الأصلي
        const parseErr = firstErr;
        const msg = parseErr instanceof Error ? parseErr.message : 'parse error';
        return new Response(JSON.stringify({
          error: 'Claude hat kein gültiges JSON zurückgegeben.',
          detail: msg,
          raw: raw.slice(0, 500),
          cleaned: cleaned.slice(0, 500),
        }), {
          status: 502,
          headers: { 'content-type': 'application/json', ...cors },
        });
      }
    }

    // cache: basic/deep ثابت لكل كلمة؛ ask/analyze/generate مخصّصة أو عشوائيّة
    const cacheHeader = (mode === 'ask' || mode === 'analyze' || mode === 'generate')
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
    const isAbort = err instanceof Error && err.name === 'AbortError';
    return new Response(JSON.stringify({
      error: isAbort
        ? 'انتهت المهلة. حاول بنصّ أقصر (أقل من 1500 حرف).'
        : 'Serverfehler',
      detail: msg,
    }), {
      status: isAbort ? 504 : 500,
      headers: { 'content-type': 'application/json', ...cors },
    });
  }
}
