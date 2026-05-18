/**
 * فئة بطاقات Cards Café — مستوحاة من لعبة Talk-Box الألمانية.
 *
 * كل فئة تحوي عنواناً ألمانياً (مثلاً "GEFÄLLT MIR") و 15 سؤالاً
 * مفتوحاً يدفع المستخدم للتفكير و التحدث بالألمانية مع نفسه.
 *
 * الفكرة التعليمية: Output Hypothesis — التحدث الذاتي (Self-Talk)
 * يجبر العقل على إنتاج اللغة و اكتشاف الفجوات.
 */
export interface CafeCategory {
  /** معرّف فريد يُستخدم في URL */
  id: string;

  /** العنوان الألماني (UPPERCASE حسب التصميم الأصلي) */
  title: string;

  /** ترجمة سريعة للعنوان (للمستخدمين الجدد) */
  titleHelper: string;

  /** Emoji أيقونة (بديل لـ icons المرئية في اللعبة الأصلية) */
  emoji: string;

  /**
   * لون Tailwind base (مطابق ألوان البطاقات في الصورة).
   * يُستخدم في [class.bg-X-500] في الـ template لأن Tailwind JIT
   * يحتاج class كاملة في الـ source.
   */
  color: CafeColor;

  /** وصف قصير لما تغطيه الفئة (يظهر تحت العنوان في القائمة) */
  description: string;

  /**
   * 15 سؤال ألماني مفتوح.
   * أسئلة مفتوحة (لا "نعم/لا") لتشجيع المحادثة الطويلة.
   */
  questions: string[];
}

/**
 * الألوان المسموحة — نستخدم union type كي يحذّرنا TypeScript لو كتبنا
 * لوناً غير مدعوم في الـ template (مثلاً "blue" ليس في القائمة).
 *
 * هذه الألوان مطابقة قدر الإمكان لألوان بطاقات اللعبة الأصلية.
 */
export type CafeColor =
  | 'amber'    // GEFÄLLT MIR — yellow
  | 'orange'   // ICH & DU — orange
  | 'teal'     // LIFESTYLE — turquoise
  | 'sky'      // SPORT & GESUNDHEIT — light blue
  | 'rose'     // MEIN HERZ — pink
  | 'yellow'   // GEFÄLLT MIR NICHT — ochre/brown-yellow
  | 'lime'     // GEFÜHLE & BEZIEHUNGEN — green
  | 'cyan'     // MUST-HAVE? — dark teal
  | 'purple'   // HIMMEL & ERDE — purple
  | 'pink';    // GANZ WICHTIG — magenta/pink
