import { LevelCode } from './level.model';

/**
 * كورس تعليمي منهجي (Course) — يتبع نهج CEFR مثل VHS و الكتب العالمية.
 *
 * الفرق الجوهري عن باقي الأقسام:
 *   - Practice/Topics/Café = تمارين حرّة (عشوائية أو مواضيع منفصلة)
 *   - Course = مسار خطّي ممنهج (Lektion 1 → 2 → 3 …) بتقدّم مقفل
 *
 * كل كورس مقسّم إلى "Lektionen" (دروس)، كل درس محتوى كامل:
 * أهداف + مفردات + قواعد + نص قراءة.
 */
export interface Course {
  /** معرّف فريد يُستخدم في URL (مثل 'b1') */
  id: string;

  /** المستوى وفق CEFR */
  level: LevelCode;

  /** عنوان الكورس المعروض */
  title: string;

  /** وصف قصير لما يغطّيه الكورس */
  description: string;

  /** Emoji للعرض في البطاقة */
  emoji: string;

  /** لون Tailwind base (يُستخدم في [class.bg-X] في الـ template) */
  color: string;

  /** الدروس بالترتيب (التسلسل مهم — التقدّم مقفل) */
  lektionen: Lektion[];
}

/**
 * درس واحد (Lektion) — وحدة تعليمية كاملة بأسلوب الكتاب.
 */
export interface Lektion {
  /** معرّف فريد عبر كل الكورسات (مثل 'b1-l1') — يُستخدم لتتبّع الإنجاز */
  id: string;

  /** رقم الدرس داخل الكورس (1, 2, 3 …) */
  number: number;

  /** عنوان الدرس بالألمانية (مثل 'Freundschaft & Beziehungen') */
  title: string;

  /** ترجمة العنوان (للمساعدة) */
  titleEn: string;

  /**
   * أهداف التعلّم (Lernziele) — جُمل "can-do":
   * "I can introduce myself", "I can use relative clauses"…
   */
  goals: string[];

  /** المفردات الأساسية للدرس */
  vocabulary: VocabItem[];

  /** الأقسام النحوية (قد يكون فيها أكثر من قاعدة) */
  grammar: GrammarSection[];

  /** نص القراءة أو الحوار */
  reading: ReadingText;
}

/** مفردة واحدة: ألماني → إنجليزي + مثال اختياري */
export interface VocabItem {
  de: string;
  en: string;
  /** جملة مثال اختيارية تُظهر الكلمة في سياق */
  example?: string;
}

/** قسم نحوي: عنوان + شرح + أمثلة */
export interface GrammarSection {
  /** عنوان القاعدة (مثل 'Relativsätze') */
  title: string;

  /** الشرح (متعدد الأسطر، يحترم \n) */
  explanation: string;

  /** أمثلة توضيحية */
  examples: string[];
}

/** نص القراءة أو الحوار في نهاية الدرس */
export interface ReadingText {
  /** عنوان النص */
  title: string;

  /** فقرات/أسطر النص (كل عنصر سطر أو فقرة) */
  lines: string[];

  /** ترجمة إنجليزية مختصرة للنص (للفهم) */
  translation: string;
}
