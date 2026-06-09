/**
 * نماذج «Arabisch lernen» — تعلّم العربية عبر مواقف حياتية.
 *
 * الفكرة المركزية:
 *   - مسارا تعلّم: Fusha (فصحى) و Syrian (سورية).
 *   - دروس عبارة عن «سيناريوهات» (مواقف): مطعم، طبيب، تعارف، …
 *   - كل جملة ثنائية: تحوي الصيغة الفصحى و السورية → مقارنة فورية.
 *   - أنماط تدريب متعدّدة (استماع، محادثة، رد، إكمال، ترجمة).
 */

export type LearnPath = 'fusha' | 'syrian';

export interface ArabicForm {
  ar: string;
  translit: string;
}

/** جملة ثنائية: نفس المعنى في الصيغتين + الترجمة الألمانية */
export interface BilingualSentence {
  fusha: ArabicForm;
  syrian: ArabicForm;
  /** الترجمة الألمانية */
  de: string;
  /** ملاحظة شرحية اختيارية (بالألمانية) */
  note?: string;
}

/** مفردة ثنائية */
export interface BilingualVocab {
  fusha: ArabicForm;
  syrian: ArabicForm;
  /** ترجمة ألمانية */
  de: string;
  /** ملاحظة قصيرة */
  note?: string;
}

// ───── أنواع الخطوات ─────

interface BaseStep {
  kind: StepKind;
}

export type StepKind =
  | 'intro' | 'vocab' | 'listen' | 'dialogue'
  | 'respond' | 'fill' | 'translate' | 'recap';

/** تمهيد الموقف */
export interface IntroStep extends BaseStep {
  kind: 'intro';
  /** «Stell dir vor: Du bist in …» */
  scenario: string;
  goals: string[];
}

/** المفردات الأساسية في سياق الموقف */
export interface VocabStep extends BaseStep {
  kind: 'vocab';
  /** عنوان ألماني («Wichtige Wörter») */
  title: string;
  items: BilingualVocab[];
}

/** تمرين استماع لجملة واحدة */
export interface ListenStep extends BaseStep {
  kind: 'listen';
  prompt: string;
  sentence: BilingualSentence;
}

/** محادثة كاملة */
export interface DialogueStep extends BaseStep {
  kind: 'dialogue';
  title: string;
  /** أسماء المتحدّثين (ألماني): ["A: Kellner", "B: Du"] */
  speakers: string[];
  /** كل سطر: speaker index + الجملة الثنائية */
  lines: { speaker: number; sentence: BilingualSentence }[];
}

/** «ماذا تقول؟» — اختيار من متعدّد لردّ مناسب */
export interface RespondStep extends BaseStep {
  kind: 'respond';
  /** السياق بالألمانية */
  situation: string;
  /** ما قاله الطرف الآخر (عربي + ترجمة) */
  prompt: BilingualSentence;
  /** السؤال بالألمانية («Was antwortest du?») */
  question: string;
  options: BilingualSentence[];
  correct: number;
  /** شرح بالألمانية */
  explanation: string;
}

/** أكمل الجملة الناقصة */
export interface FillStep extends BaseStep {
  kind: 'fill';
  prompt: string;       // «Vervollständige:»
  /** ما قبل الفراغ في الصيغتين */
  before: ArabicForm;
  /** ما بعد الفراغ في الصيغتين (قد يكون فارغاً) */
  after: ArabicForm;
  /** خيارات الكلمة الناقصة */
  options: ArabicForm[];
  correct: number;
  /** المعنى الألماني الكامل */
  de: string;
  explanation: string;
}

/** ترجمة من ألماني إلى عربي */
export interface TranslateStep extends BaseStep {
  kind: 'translate';
  prompt: string;       // «Wie sagt man auf Arabisch?»
  /** الجملة الألمانية المطلوب ترجمتها */
  german: string;
  options: BilingualSentence[];
  correct: number;
  explanation: string;
}

/** مراجعة */
export interface RecapStep extends BaseStep {
  kind: 'recap';
  title: string;
  points: string[];
}

export type Step =
  | IntroStep | VocabStep | ListenStep | DialogueStep
  | RespondStep | FillStep | TranslateStep | RecapStep;

// ───── الفئات و المواقف ─────

export interface Category {
  id: string;
  /** الاسم بالألمانية */
  name: string;
  emoji: string;
}

export interface Scenario {
  id: string;
  emoji: string;
  /** العنوان بالألمانية */
  title: string;
  categoryId: string;
  /** سياق قصير بالألمانية (يظهر في البطاقة) */
  context: string;
  /** ترتيب صعوبة 1-3 */
  level: 1 | 2 | 3;
  /** المسارات التي يظهر فيها هذا الموقف (الافتراضي: كلاهما) */
  paths?: LearnPath[];
  steps: Step[];
}

export interface ArabicScenariosData {
  categories: Category[];
  scenarios: Scenario[];
}
