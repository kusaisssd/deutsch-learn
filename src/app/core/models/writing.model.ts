/**
 * نماذج قسم الكتابة (Schreiben).
 *
 * الفكرة: تدريب المستخدم على كتابة نصّ مترابط بالألمانية (B1) عبر:
 *   - دليل الترابط (أدوات الربط مصنّفة).
 *   - تمارين كتابة موجّهة: لكل تمرين سقالة كاملة (نقاط، بنية، عبارات مفيدة،
 *     قائمة تحقّق) + نموذج إجابة للمقارنة الذاتية.
 *
 * لا يوجد تصحيح آلي (لا backend) → التعلّم بالمقارنة و التحقّق الذاتي.
 */

/** نوع نصّ الكتابة */
export type WritingKind = 'opinion' | 'story' | 'graph';

/** مجموعة عبارات مفيدة (Redemittel) مصنّفة */
export interface RedemittelGroup {
  /** عنوان المجموعة بالعربي (مثلاً: «لإبداء الرأي») */
  label: string;
  /** العبارات: الألمانية + ترجمتها العربية */
  phrases: { de: string; ar: string }[];
}

/** جزء من بنية النص (مقدّمة / صلب / خاتمة) */
export interface StructurePart {
  /** اسم الجزء (مثلاً: «المقدّمة (Einleitung)») */
  part: string;
  /** ما الذي يُكتب في هذا الجزء (بالعربي) */
  hint: string;
  /** عبارات بداية ألمانية جاهزة */
  starters: string[];
}

/** تمرين كتابة واحد */
export interface WritingTask {
  id: string;
  kind: WritingKind;
  level: string;
  emoji: string;
  /** العنوان الألماني */
  title: string;
  /** العنوان العربي */
  titleAr: string;
  /** نصّ المهمّة بالألمانية (Aufgabe) */
  prompt: string;
  /** شرح المهمّة بالعربي */
  promptAr: string;
  /** الحدّ الأدنى المُقترح لعدد الكلمات */
  minWords: number;
  /** النقاط المطلوب تغطيتها (Leitpunkte) — عربي مع كلمات مفتاحية ألمانية */
  leitpunkte: string[];
  /** بنية النص المقترحة */
  structure: StructurePart[];
  /** عبارات مفيدة مصنّفة */
  redemittel: RedemittelGroup[];
  /** قائمة تحقّق ذاتية (بالعربي) */
  checklist: string[];
  /** نموذج الإجابة الألماني (فقرات مفصولة بـ \n\n) */
  model: string;
  /** ملاحظات بالعربي حول النموذج (ما الذي يجعله جيّداً) */
  modelNotesAr: string;
}

/** مجموعة أدوات ربط في دليل الترابط */
export interface ConnectorGroup {
  /** التصنيف بالعربي (مثلاً: «الترتيب الزمني») */
  category: string;
  emoji: string;
  items: { de: string; ar: string; example: string }[];
}

/** بنية ملف writing.json الكامل */
export interface WritingData {
  guide: {
    /** مقدّمة بالعربي عن الترابط */
    intro: string;
    connectors: ConnectorGroup[];
  };
  tasks: WritingTask[];
}
