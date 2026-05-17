import { LevelCode } from './level.model';

/**
 * جملة واحدة للتمرين.
 * مثال:
 *   {
 *     id: 1,
 *     level: 'A1',
 *     english: 'I drink water',
 *     germanWords: ['Ich', 'trinke', 'Wasser']
 *   }
 *
 * المستخدم سيرى الجملة الإنجليزية، و الكلمات الألمانية مخلوطة،
 * و عليه ترتيبها بنفس ترتيب germanWords ليفوز.
 */
export interface Sentence {
  id: number;                  // معرّف فريد
  level: LevelCode;            // أي مستوى ينتمي إليه
  english: string;             // الجملة بالإنجليزية (مرجع للمستخدم)
  germanWords: string[];       // الكلمات الألمانية بالترتيب الصحيح
  hint?: string;               // تلميح اختياري (مثل قاعدة نحوية)
}
