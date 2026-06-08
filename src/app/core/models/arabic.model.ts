/**
 * نماذج قسم «تعلم العربية» — كلمات ألمانية مع مقابلها بالعربية:
 *   - الفصحى (Hocharabisch / MSA)
 *   - السورية (Syrisch-Levantinisch)
 * مع نقل صوتي بحروف لاتينية ملائمة للمتحدّث الألماني.
 */

export interface ArabicForm {
  /** النص بالعربية (للقراءة و الـ TTS) */
  ar: string;
  /** نقل صوتي بحروف لاتينية بأسلوب ألماني (sch, ch, j…) */
  translit: string;
}

export interface ArabicWord {
  /** الكلمة/العبارة بالألمانية */
  de: string;
  /** الفصحى */
  fusha: ArabicForm;
  /** السورية (Damaszener) */
  syrian: ArabicForm;
  /** ملاحظة قصيرة بالألمانية (الفرق، السياق، …) */
  note?: string;
}

export interface ArabicCategory {
  id: string;
  /** الاسم بالألمانية (للواجهة) */
  de: string;
  /** الاسم بالعربية (للنسخة المختلطة) */
  ar: string;
  emoji: string;
  words: ArabicWord[];
}

/** مفتاح نطق لحروف عربية صعبة على المتحدّث الألماني */
export interface PronunciationKey {
  ar: string;
  translit: string;
  /** شرح بالألمانية */
  de: string;
  /** مثال ألماني للتشبيه */
  example?: string;
}

export interface ArabicData {
  pronunciationKey: PronunciationKey[];
  categories: ArabicCategory[];
}
