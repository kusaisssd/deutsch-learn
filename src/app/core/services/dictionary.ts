import { effect, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  DictHistoryEntry, Gender, LookupResult, MyMemoryResponse, NounCaseRow, NounResult,
  RawNoun, RawVerb, VerbConjRow, VerbResult, VerbTenseTable,
} from '../models/dictionary.model';

/** أدوات التعريف حسب الحالة و الجنس (مفرد) + الجمع */
const ARTICLES = {
  NOM: { M: 'der', F: 'die', N: 'das', P: 'die' },
  AKK: { M: 'den', F: 'die', N: 'das', P: 'die' },
  DAT: { M: 'dem', F: 'der', N: 'dem', P: 'den' },
  GEN: { M: 'des', F: 'der', N: 'des', P: 'der' },
} as const;

const GENDER_AR: Record<Gender, string> = { M: 'مذكّر', F: 'مؤنّث', N: 'محايد' };

/** الضمائر الستّة بالترتيب: ich, du, er/sie/es, wir, ihr, sie/Sie */
const PRONOUNS_DE = ['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie/Sie'];
const PRONOUNS_AR = ['أنا', 'أنتَ', 'هو/هي', 'نحن', 'أنتم', 'هم/حضرتك'];

/** تصريف haben/sein في الحاضر (لبناء الـ Perfekt) */
const HABEN_PRES = ['habe', 'hast', 'hat', 'haben', 'habt', 'haben'];
const SEIN_PRES = ['bin', 'bist', 'ist', 'sind', 'seid', 'sind'];

/** مفتاح تخزين الترجمات المُخبّأة محلياً */
const TRANSLATIONS_KEY = 'deutsch-learn:dict-translations';
/** مفتاح تخزين سجلّ الكلمات المبحوثة (لقسم «ذاكرة قاموسي») */
const HISTORY_KEY = 'deutsch-learn:dict-history';

/**
 * DictionaryService — يحمّل قاموسَي الأسماء و الأفعال (lazy، مرّة واحدة)
 * و يبني جداول التصريف، و يوفّر:
 *   - اقتراحات إملائية offline (umlaut/ß، أخطاء بسيطة، تبديل ie/ei).
 *   - ترجمة عربية عبر MyMemory (online) مع تخزين محلي للنتائج.
 *
 * بيانات التصريف تعمل كلياً offline؛ الترجمة تحتاج اتصالاً لأول مرّة لكل
 * كلمة، ثم تُخبّأ فتصبح فورية.
 */
@Injectable({ providedIn: 'root' })
export class DictionaryService {
  private http = inject(HttpClient);

  private readonly _nouns = signal<Record<string, RawNoun> | null>(null);
  private readonly _verbs = signal<Record<string, RawVerb> | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal(false);

  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  /** هل اكتمل تحميل البيانات؟ */
  readonly ready = signal(false);

  // ───────── الترجمة (online + cache) ─────────
  private readonly _translations = signal<Record<string, string>>(this.loadTranslations());
  private readonly _translating = signal<Set<string>>(new Set());
  private readonly _transFailed = signal<Set<string>>(new Set());

  // ───────── سجلّ البحث (للذاكرة لاحقاً) ─────────
  private readonly _history = signal<DictHistoryEntry[]>(this.loadHistory());
  /** كل الكلمات التي بحثها المستخدم (الأحدث أولاً) */
  readonly history = this._history.asReadonly();

  /** فهرس مُطبَّع للاقتراحات (يُبنى مرّة بعد التحميل) */
  private index: Map<string, string[]> | null = null;

  constructor() {
    this.load();
    // حفظ الترجمات و السجلّ تلقائياً
    effect(() => this.saveTranslations(this._translations()));
    effect(() => this.save(HISTORY_KEY, this._history()));
  }

  /** يسجّل كلمة مبحوثة (يزيل التكرار و يضعها في المقدّمة) */
  record(entry: Omit<DictHistoryEntry, 'ts'>): void {
    this._history.update(list => {
      const rest = list.filter(x => !(x.word === entry.word && x.kind === entry.kind));
      return [{ ...entry, ts: Date.now() }, ...rest].slice(0, 1000);
    });
  }

  /** يحذف كلمة من السجلّ */
  removeFromHistory(word: string, kind: 'noun' | 'verb'): void {
    this._history.update(list => list.filter(x => !(x.word === word && x.kind === kind)));
  }

  clearHistory(): void {
    this._history.set([]);
  }

  private load(): void {
    this._loading.set(true);
    this._error.set(false);
    let done = 0;
    const finish = () => {
      if (++done === 2) {
        this._loading.set(false);
        this.ready.set(true);
      }
    };
    this.http.get<Record<string, RawNoun>>('/data/dict-nouns.json').subscribe({
      next: (d) => { this._nouns.set(d); finish(); },
      error: () => { this._error.set(true); this._loading.set(false); },
    });
    this.http.get<Record<string, RawVerb>>('/data/dict-verbs.json').subscribe({
      next: (d) => { this._verbs.set(d); finish(); },
      error: () => { this._error.set(true); this._loading.set(false); },
    });
  }

  retry(): void {
    if (!this.ready()) this.load();
  }

  // ═══════════════════════════════════════════
  // البحث
  // ═══════════════════════════════════════════

  lookup(raw: string): LookupResult | null {
    const query = raw.trim();
    if (!query) return null;
    const nouns = this._nouns();
    const verbs = this._verbs();
    if (!nouns || !verbs) return null;

    const cap = query.charAt(0).toUpperCase() + query.slice(1);
    const rawNoun = nouns[query] ?? nouns[cap] ?? null;
    const noun = rawNoun ? this.buildNoun(rawNoun[1] || cap, rawNoun) : null;

    const lower = query.toLowerCase();
    const rawVerb = verbs[lower] ?? verbs[query] ?? null;
    const verb = rawVerb ? this.buildVerb(lower, rawVerb) : null;

    return { query, noun, verb };
  }

  // ═══════════════════════════════════════════
  // الاقتراحات (offline)
  // ═══════════════════════════════════════════

  /**
   * يطبّع الكلمة لمطابقة تسامحية: حروف صغيرة، ß→ss، و توحيد الـ Umlaut
   * مع صيغها اللاتينية (ä/ae→a …). يحلّ نسيان الـ Umlaut و كتابته كـ ae.
   */
  private norm(s: string): string {
    return s.toLowerCase()
      .replace(/ß/g, 'ss')
      .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u')
      .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u');
  }

  /** مسافة تعديل محدودة (Levenshtein) — تتوقّف مبكراً إن تجاوزت max */
  private editDistance(a: string, b: string, max: number): number {
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > max) return max + 1;
    let prev = new Array(lb + 1);
    for (let j = 0; j <= lb; j++) prev[j] = j;
    for (let i = 1; i <= la; i++) {
      const cur = new Array(lb + 1);
      cur[0] = i;
      let best = i;
      const ai = a.charCodeAt(i - 1);
      for (let j = 1; j <= lb; j++) {
        const cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (cur[j] < best) best = cur[j];
      }
      if (best > max) return max + 1;
      prev = cur;
    }
    return prev[lb];
  }

  private buildIndex(): void {
    if (this.index) return;
    const idx = new Map<string, string[]>();
    const add = (key: string) => {
      const n = this.norm(key);
      const arr = idx.get(n);
      if (arr) { if (!arr.includes(key)) arr.push(key); }
      else idx.set(n, [key]);
    };
    const nouns = this._nouns();
    const verbs = this._verbs();
    if (nouns) for (const k of Object.keys(nouns)) add(k);
    if (verbs) for (const k of Object.keys(verbs)) add(k);
    this.index = idx;
  }

  /**
   * اقتراحات لكلمة غير موجودة:
   *   1) مطابقة مُطبَّعة تامّة (نسيان Umlaut/ß/حالة الأحرف).
   *   2) مسافة تعديل ≤ 2 (أخطاء بسيطة و تبديل ie/ei).
   */
  suggest(raw: string): string[] {
    const q = raw.trim();
    if (!q || !this.ready()) return [];
    this.buildIndex();
    const idx = this.index!;
    const nq = this.norm(q);

    const out: string[] = [];
    const seen = new Set<string>();
    const push = (w: string) => { if (!seen.has(w)) { seen.add(w); out.push(w); } };

    // 1) مطابقة مُطبَّعة تامّة
    const exact = idx.get(nq);
    if (exact) exact.forEach(push);

    // 2) مسافة تعديل ≤ 2 (مع تصفية بأول حرف و الطول للسرعة)
    if (out.length < 8) {
      const first = nq.charAt(0);
      const cands: [number, string][] = [];
      for (const [n, words] of idx) {
        if (n === nq || n.charAt(0) !== first) continue;
        if (Math.abs(n.length - nq.length) > 2) continue;
        const d = this.editDistance(nq, n, 2);
        if (d <= 2) for (const w of words) cands.push([d, w]);
      }
      cands.sort((a, b) => a[0] - b[0] || a[1].length - b[1].length);
      for (const [, w] of cands) { if (out.length >= 8) break; push(w); }
    }

    return out.slice(0, 8);
  }

  // ═══════════════════════════════════════════
  // الترجمة العربية (MyMemory)
  // ═══════════════════════════════════════════

  /** الترجمة المُخبّأة لكلمة (أو undefined إن لم تُجلب بعد) */
  translationOf(word: string): string | undefined {
    return this._translations()[word.toLowerCase()];
  }

  isTranslating(word: string): boolean {
    return this._translating().has(word.toLowerCase());
  }

  translationFailed(word: string): boolean {
    return this._transFailed().has(word.toLowerCase());
  }

  /** يجلب الترجمة (إن لم تكن مُخبّأة) من MyMemory و يخزّنها */
  translate(word: string): void {
    const key = word.trim().toLowerCase();
    if (!key) return;
    if (this._translations()[key] !== undefined) return; // مُخبّأة
    if (this._translating().has(key)) return;            // جارية

    this._translating.update(s => new Set(s).add(key));
    this._transFailed.update(s => { const n = new Set(s); n.delete(key); return n; });

    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=de|ar`;
    this.http.get<MyMemoryResponse>(url).subscribe({
      next: (res) => {
        const t = res?.responseData?.translatedText?.trim();
        const ok = res?.responseStatus === 200 && t && !/MYMEMORY|INVALID|PLEASE SELECT|QUERY LENGTH/i.test(t);
        if (ok) {
          this._translations.update(m => ({ ...m, [key]: t! }));
        } else {
          this._transFailed.update(s => new Set(s).add(key));
        }
        this._translating.update(s => { const n = new Set(s); n.delete(key); return n; });
      },
      error: () => {
        this._transFailed.update(s => new Set(s).add(key));
        this._translating.update(s => { const n = new Set(s); n.delete(key); return n; });
      },
    });
  }

  private loadTranslations(): Record<string, string> {
    try {
      const raw = localStorage.getItem(TRANSLATIONS_KEY);
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      return {};
    }
  }

  private saveTranslations(map: Record<string, string>): void {
    this.save(TRANSLATIONS_KEY, map);
  }

  private loadHistory(): DictHistoryEntry[] {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? (JSON.parse(raw) as DictHistoryEntry[]) : [];
    } catch {
      return [];
    }
  }

  private save(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn(`Failed to save to localStorage (${key}):`, e);
    }
  }

  // ═══════════════════════════════════════════
  // بناء النتائج
  // ═══════════════════════════════════════════

  private buildNoun(word: string, r: RawNoun): NounResult {
    const [g, nomS, nomP, akkS, akkP, datS, datP, genS, genP] = r;
    const cases: { key: keyof typeof ARTICLES; de: string; ar: string; s: string; p: string }[] = [
      { key: 'NOM', de: 'Nominativ', ar: 'النوميناتيف (الفاعل)', s: nomS, p: nomP },
      { key: 'AKK', de: 'Akkusativ', ar: 'الأكوزاتيف (المفعول المباشر)', s: akkS, p: akkP },
      { key: 'DAT', de: 'Dativ', ar: 'الداتيف (المفعول غير المباشر)', s: datS, p: datP },
      { key: 'GEN', de: 'Genitiv', ar: 'الجينيتيف (المِلكية)', s: genS, p: genP },
    ];

    const rows: NounCaseRow[] = cases.map(c => ({
      caseDe: c.de,
      caseAr: c.ar,
      articleSin: ARTICLES[c.key][g],
      formSin: c.s || nomS,
      articlePlu: ARTICLES[c.key].P,
      formPlu: c.p || nomP,
      example: this.nounExample(c.key, g, nomS, genS || nomS),
    }));

    return {
      word,
      gender: g,
      article: ARTICLES.NOM[g],
      genderAr: GENDER_AR[g],
      pluralNom: nomP || '—',
      rows,
    };
  }

  private nounExample(key: keyof typeof ARTICLES, g: Gender, nomSin: string, genSin: string): string {
    switch (key) {
      case 'NOM': return `${ARTICLES.NOM[g]} ${nomSin} ist hier.`;
      case 'AKK': return `Ich sehe ${ARTICLES.AKK[g]} ${nomSin}.`;
      case 'DAT': return `Ich komme mit ${ARTICLES.DAT[g]} ${nomSin}.`;
      case 'GEN': return `Das ist die Farbe ${ARTICLES.GEN[g]} ${genSin}.`;
    }
  }

  private buildVerb(verb: string, r: RawVerb): VerbResult {
    const auxPres = r.sein ? SEIN_PRES : HABEN_PRES;
    const tenses: VerbTenseTable[] = [];

    tenses.push(this.tense('Präsens', 'الحاضر', r.pres.map((f, i) => `${PRONOUNS_DE[i]} ${f}`)));

    if (r.pret) {
      tenses.push(this.tense('Präteritum', 'الماضي البسيط', r.pret.map((f, i) => `${PRONOUNS_DE[i]} ${f}`)));
    }

    if (r.p2) {
      tenses.push(this.tense(
        'Perfekt', 'الماضي التام (Perfekt)',
        auxPres.map((aux, i) => `${PRONOUNS_DE[i]} ${aux} ${r.p2}`),
      ));
    }

    return {
      infinitive: verb,
      partizip2: r.p2 || '—',
      aux: r.sein ? 'sein' : 'haben',
      tenses,
    };
  }

  private tense(de: string, ar: string, forms: string[]): VerbTenseTable {
    const rows: VerbConjRow[] = forms.map((form, i) => ({
      pronounDe: PRONOUNS_DE[i],
      pronounAr: PRONOUNS_AR[i],
      form,
    }));
    return { de, ar, rows };
  }
}
