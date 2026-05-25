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
 * درس واحد (Lektion) — وحدة تعليمية.
 *
 * 🆕 نمطان مدعومان:
 *   1) تفاعلي (الجديد): يملأ `steps` بسلسلة خطوات صغيرة (Duolingo-style).
 *   2) كتابي (القديم): يملأ goals/vocabulary/grammar/reading.
 *
 * صفحة الدرس تُفضّل `steps` لو موجودة، و إلا تعرض النمط الكتابي.
 * هذا يسمح بترقية الدروس تدريجياً (backward compatible).
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
   * 🆕 الخطوات التفاعلية (النمط الجديد). لو موجودة → المُشغّل التفاعلي.
   */
  steps?: LektionStep[];

  // ───────── النمط الكتابي القديم (اختياري الآن) ─────────

  /** أهداف التعلّم (Lernziele) */
  goals?: string[];
  /** المفردات الأساسية */
  vocabulary?: VocabItem[];
  /** الأقسام النحوية */
  grammar?: GrammarSection[];
  /** نص القراءة */
  reading?: ReadingText;
}

/**
 * خطوة تفاعلية واحدة داخل درس.
 *
 * 🎓 لماذا interface واحد بحقول اختيارية بدل discriminated union صارم؟
 *   لأن Angular templates تتعامل بسلاسة مع الحقول الاختيارية،
 *   بينما narrowing الـ union داخل @switch قد يسبب أخطاء type في الـ template.
 *   هذا اختيار براغماتي شائع للمحتوى المُدار بـ JSON.
 *
 * الأنواع (kind):
 *   'intro'     → بطاقة تأطير (title + text)
 *   'flashcard' → كلمة تُقلب (front → back + example)
 *   'quiz'      → سؤال اختيار من متعدد (question + options + correct)
 *   'discovery' → اكتشاف استقرائي (examples → question → reveal)
 *   'reading'   → نص قصير + سؤال فهم
 *   'recap'     → ملخّص نهائي (title + points)
 */
export interface LektionStep {
  kind: 'intro' | 'flashcard' | 'quiz' | 'discovery' | 'reading' | 'recap';

  // intro / recap
  title?: string;
  text?: string;
  points?: string[];

  // flashcard
  front?: string;       // الكلمة الألمانية
  back?: string;        // المعنى
  example?: string;     // جملة مثال

  // quiz / reading
  prompt?: string;      // سطر سياق اختياري فوق السؤال
  question?: string;
  options?: string[];
  correct?: number;     // index الإجابة الصحيحة
  explanation?: string; // يظهر بعد الإجابة

  // discovery
  instruction?: string; // تعليمة ("لاحظ هذه الأمثلة…")
  examples?: string[];
  reveal?: string;      // القاعدة المكتشفة (تظهر بعد التفكير)

  // reading
  lines?: string[];     // أسطر النص
  translation?: string; // ترجمة مختصرة
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
