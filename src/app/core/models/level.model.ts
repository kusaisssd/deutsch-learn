/**
 * مستويات تعلم الألمانية حسب إطار CEFR الأوروبي.
 * A1 = مبتدئ تماماً → B2 = متوسط متقدم
 */
export type LevelCode = 'A1' | 'A2' | 'B1' | 'B2';

/**
 * معلومات عن مستوى واحد لعرضه في صفحة اختيار المستوى.
 */
export interface Level {
  code: LevelCode;          // الرمز (A1, A2, ...)
  title: string;            // عنوان للعرض ("مبتدئ")
  description: string;      // وصف قصير
  color: string;            // لون Tailwind (مثلاً 'bg-green-500')
}
