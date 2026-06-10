/**
 * نماذج «Wortbildung» — تدريب بناء الكلمات من الأحرف.
 *
 * المستخدم يرى المعنى الألماني و الأحرف مبعثرة، فيرتّبها بالنقر
 * ليُكوّن الكلمة العربية.
 */

export type Difficulty = 1 | 2 | 3;

export interface WordBuilding {
  id: string;
  /** الكلمة الكاملة مع التشكيل (للعرض النهائي) */
  word: string;
  /** النقل اللاتيني (للنطق) */
  translit: string;
  /** الترجمة الألمانية */
  de: string;
  /** الأحرف بالترتيب الصحيح (بلا تشكيل) — تُخلط للعرض */
  letters: string[];
  difficulty: Difficulty;
  /** ملاحظة قصيرة اختيارية بالألمانية */
  note?: string;
}

export interface ArabicWordBuildingData {
  words: WordBuilding[];
}

/** معلومات حرف عربي للعرض (الاسم + الصوت + التشبيه الألماني) */
export interface LetterInfo {
  name: string;     // مثل "Bā"
  sound: string;    // مثل "b"
  hint?: string;    // تشبيه ألماني قصير
}
