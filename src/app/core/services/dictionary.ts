import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  Gender, LookupResult, NounCaseRow, NounResult,
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

/**
 * DictionaryService — يحمّل قاموسَي الأسماء و الأفعال (lazy، مرّة واحدة)
 * و يبني جداول التصريف الجاهزة للعرض.
 *
 * يُحمَّل عند أوّل حقن للخدمة (أي عند فتح صفحة القاموس فقط)، فلا يُثقل
 * بقيّة التطبيق. بعد التحميل يعمل كلياً من ذاكرة المتصفّح (offline).
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

  constructor() {
    this.load();
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

  /** إعادة محاولة التحميل بعد خطأ */
  retry(): void {
    if (!this.ready()) this.load();
  }

  /**
   * بحث عن كلمة: تُرجع نتيجة اسم و/أو فعل (قد تكون الكلمة كليهما).
   * - الأسماء مُخزَّنة بأول حرف كبير → نجرّب الكلمة كما هي ثم بصيغة capitalized.
   * - الأفعال مصادر بحروف صغيرة → نجرّب lowercase.
   */
  lookup(raw: string): LookupResult | null {
    const query = raw.trim();
    if (!query) return null;
    const nouns = this._nouns();
    const verbs = this._verbs();
    if (!nouns || !verbs) return null;

    // اسم
    const cap = query.charAt(0).toUpperCase() + query.slice(1);
    const rawNoun = nouns[query] ?? nouns[cap] ?? null;
    const noun = rawNoun ? this.buildNoun(rawNoun[1] || cap, rawNoun) : null;

    // فعل
    const lower = query.toLowerCase();
    const rawVerb = verbs[lower] ?? verbs[query] ?? null;
    const verb = rawVerb ? this.buildVerb(lower, rawVerb) : null;

    if (!noun && !verb) return { query, noun: null, verb: null };
    return { query, noun, verb };
  }

  // ───────── بناء نتيجة الاسم ─────────
  private buildNoun(word: string, r: RawNoun): NounResult {
    const [g, nomS, nomP, akkS, akkP, datS, datP, genS, genP] = r;
    const cases: { key: keyof typeof ARTICLES; de: string; ar: string; s: string; p: string }[] = [
      { key: 'NOM', de: 'Nominativ', ar: 'النوميناتيف (الفاعل)', s: nomS, p: nomP },
      { key: 'AKK', de: 'Akkusativ', ar: 'الأكوزاتيف (المفعول المباشر)', s: akkS, p: akkP },
      { key: 'DAT', de: 'Dativ', ar: 'الداتيف (المفعول غير المباشر)', s: datS, p: datP },
      { key: 'GEN', de: 'Genitiv', ar: 'الجينيتيف (المِلكية)', s: genS, p: genP },
    ];

    const rows: NounCaseRow[] = cases.map(c => {
      const artSin = ARTICLES[c.key][g];
      const artPlu = ARTICLES[c.key].P;
      return {
        caseDe: c.de,
        caseAr: c.ar,
        articleSin: artSin,
        formSin: c.s || nomS,
        articlePlu: artPlu,
        formPlu: c.p || nomP,
        example: this.nounExample(c.key, g, nomS, genS || nomS),
      };
    });

    return {
      word,
      gender: g,
      article: ARTICLES.NOM[g],
      genderAr: GENDER_AR[g],
      pluralNom: nomP || '—',
      rows,
    };
  }

  /** مثال ألماني يوضّح كل حالة (أداة + اسم) */
  private nounExample(key: keyof typeof ARTICLES, g: Gender, nomSin: string, genSin: string): string {
    switch (key) {
      case 'NOM': return `${ARTICLES.NOM[g]} ${nomSin} ist hier.`;
      case 'AKK': return `Ich sehe ${ARTICLES.AKK[g]} ${nomSin}.`;
      case 'DAT': return `Ich komme mit ${ARTICLES.DAT[g]} ${nomSin}.`;
      case 'GEN': return `Das ist die Farbe ${ARTICLES.GEN[g]} ${genSin}.`;
    }
  }

  // ───────── بناء نتيجة الفعل ─────────
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
