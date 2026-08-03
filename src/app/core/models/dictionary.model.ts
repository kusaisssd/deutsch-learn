/**
 * نماذج القاموس (Dictionary).
 *
 * البيانات الخام تأتي من ملفّين مضغوطين (انظر scripts/build-dict.mjs):
 *   - dict-nouns.json : { word: [G, NOM.S, NOM.P, AKK.S, AKK.P, DAT.S, DAT.P, GEN.S, GEN.P] }
 *   - dict-verbs.json : { verb: { p2, sein, pres[6], pret[6]|null } }
 *
 * الـ DictionaryService يحوّلها إلى النماذج التالية الجاهزة للعرض.
 */

export type Gender = 'M' | 'F' | 'N';

/** الصيغة الخام للاسم (مصفوفة مضغوطة) */
export type RawNoun = [Gender, string, string, string, string, string, string, string, string];

/** الصيغة الخام للفعل */
export interface RawVerb {
  p2: string;
  sein: boolean;
  pres: string[];
  pret: string[] | null;
}

/** صفّ حالة واحدة في جدول تصريف الاسم */
export interface NounCaseRow {
  caseDe: string;       // Nominativ / Akkusativ / Dativ / Genitiv
  caseAr: string;       // الاسم العربي للحالة
  articleSin: string;   // der/den/dem/des …
  formSin: string;      // صيغة المفرد
  articlePlu: string;   // die/den/der
  formPlu: string;      // صيغة الجمع
  example: string;      // مثال ألماني يوضّح الحالة
}

/** نتيجة بحث اسم */
export interface NounResult {
  word: string;
  gender: Gender;
  article: string;      // أداة التعريف في النوميناتيف (der/die/das)
  genderAr: string;     // مذكّر / مؤنّث / محايد
  pluralNom: string;    // صيغة الجمع (Nominativ)
  rows: NounCaseRow[];
  /** هل استُنتجت كاسم مركّب (التحليل تقديري حسب الجزء الأخير)؟ */
  compound?: boolean;
  /** الجزء الأخير المعروف (Head) للاسم المركّب */
  head?: string;
}

/** صفّ ضمير في جدول تصريف فعل */
export interface VerbConjRow {
  pronounDe: string;    // ich, du, er/sie/es, wir, ihr, sie/Sie
  pronounAr: string;
  form: string;         // الصيغة المُصرَّفة الكاملة
}

/** جدول زمن واحد */
export interface VerbTenseTable {
  de: string;           // Präsens / Präteritum / Perfekt
  ar: string;           // الحاضر / الماضي / الماضي التام
  rows: VerbConjRow[];
}

/** نتيجة بحث فعل */
export interface VerbResult {
  infinitive: string;
  partizip2: string;
  aux: 'haben' | 'sein';
  tenses: VerbTenseTable[];
}

/** نتيجة البحث الكاملة (قد تكون اسماً و فعلاً معاً مثل Essen/essen) */
export interface LookupResult {
  query: string;
  noun: NounResult | null;
  verb: VerbResult | null;
}

/** استجابة MyMemory المبسّطة */
export interface MyMemoryResponse {
  responseData?: { translatedText?: string };
  responseStatus?: number;
}

/** عنصر في سجلّ البحث (يُحفَظ محلياً و يُزامَن سحابياً) */
export interface DictHistoryEntry {
  word: string;
  kind: 'noun' | 'verb' | 'phrase';
  article?: string;     // der/die/das (للأسماء)
  gender?: Gender;      // M/F/N (للأسماء)
  /** الترجمة العربية (من MyMemory أو Claude) */
  translation?: string;
  /** استجابة Claude AI الكاملة إن جُلبت */
  ai?: unknown;         // ClaudeLookupResult — نستعمل unknown هنا لتجنّب اعتماد دائري
  /** استجابة Claude «شرح أعمق» إن طُلبت */
  aiDeep?: unknown;
  /** أسئلة حرّة سبق طرحها على AI حول هذه الكلمة (Q&A) */
  asks?: unknown[];        // DictAsk[] — unknown لتجنّب اعتماد دائري
  /** وقت آخر بحث/تحديث (ms) — لترتيب الأحدث */
  ts: number;
}
