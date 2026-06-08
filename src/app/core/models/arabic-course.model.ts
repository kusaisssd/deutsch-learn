/**
 * نماذج «Arabisch lernen» Course — منهج تفاعلي للأحرف و القراءة و بناء الجمل.
 *
 * نمط الخطوات يحاكي مشغّل الدروس الألماني (lektion-page) مع نوعَين جديدَين:
 *   - letter:  حرف عربي مع 4 مواضع + صوت + 3 كلمات مثال (صوت لكل واحدة)
 *   - builder: بنّاء جملة (المتعلّم يرتّب كلمات عربية مبعثرة)
 */

export type ArabicStepKind =
  | 'intro'
  | 'letter'
  | 'flashcard'
  | 'discovery'
  | 'quiz'
  | 'reading'
  | 'builder'
  | 'speak'
  | 'recap';

interface BaseStep {
  kind: ArabicStepKind;
  /** عنوان القسم بالألمانية (يظهر فوق الخطوة) */
  section: string;
}

/** خطوة تعريفية (الأهداف) */
export interface IntroStep extends BaseStep {
  kind: 'intro';
  title: string;
  text: string;
  points: string[];
}

/** خطوة حرف (جديدة): تعرّض حرفاً عربياً + معلوماته + 3 كلمات مثال */
export interface LetterStep extends BaseStep {
  kind: 'letter';
  letter: string;          // الحرف منفرد (مثل: ب)
  name: string;            // اسم الحرف (مثل: Ba)
  translit: string;        // الصوت بحروف لاتينية (مثل: b)
  germanHint: string;      // تشبيه ألماني (مثل: «wie deutsch B»)
  /** كلمات مثال — كل واحدة مع نطق و ترجمة */
  examples: { ar: string; translit: string; de: string }[];
}

/** flashcard: ألماني → عربي + transliteration */
export interface FlashcardStep extends BaseStep {
  kind: 'flashcard';
  front: string;           // الجهة الألمانية
  back: { ar: string; translit: string };
  example?: string;        // جملة مثال عربية
}

/** discovery: اكتشاف قاعدة */
export interface DiscoveryStep extends BaseStep {
  kind: 'discovery';
  instruction: string;
  examples: string[];
  question: string;
  reveal: string;
}

/** quiz: سؤال اختيار من متعدّد بالألمانية */
export interface QuizStep extends BaseStep {
  kind: 'quiz';
  prompt: string;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

/** reading: نصّ عربي مع أسطر مترجمة + أسئلة اختيارية */
export interface ReadingStep extends BaseStep {
  kind: 'reading';
  title: string;
  lines: { ar: string; translit: string; de: string }[];
  questions?: { question: string; options: string[]; correct: number; explanation: string }[];
}

/** builder (جديدة): ترتيب كلمات عربية مبعثرة لتكوين جملة */
export interface BuilderStep extends BaseStep {
  kind: 'builder';
  prompt: string;          // مهمّة بالألمانية: «Bilde: Er ist Arzt.»
  /** الكلمات بالترتيب الصحيح — تُخلط للعرض، و يُحقَّق الترتيب */
  words: { ar: string; translit: string }[];
  hint?: string;
  /** الجملة كاملة بعد الترتيب الصحيح (للنطق و العرض) */
  fullAr: string;
  fullTranslit: string;
  /** ترجمة ألمانية كاملة */
  german: string;
}

/** speak: تدريب نطق */
export interface SpeakStep extends BaseStep {
  kind: 'speak';
  prompt: string;
  text: string;            // عربي
  translit: string;
  hint?: string;
}

/** recap: مراجعة */
export interface RecapStep extends BaseStep {
  kind: 'recap';
  title: string;
  points: string[];
}

export type ArabicStep =
  | IntroStep
  | LetterStep
  | FlashcardStep
  | DiscoveryStep
  | QuizStep
  | ReadingStep
  | BuilderStep
  | SpeakStep
  | RecapStep;

export interface ArabicLektion {
  id: string;
  number: number;
  /** العنوان الألماني (للواجهة) */
  title: string;
  /** عنوان فرعي ألماني */
  subtitle: string;
  /** Phase معرّف (1=Alphabet, 2=Lesen, 4=Satzbau) */
  phase: 1 | 2 | 4;
  steps: ArabicStep[];
}

export interface ArabicCourse {
  id: string;
  title: string;
  description: string;
  lektionen: ArabicLektion[];
}
