import { LevelCode } from './level.model';

/**
 * من يتكلم في هذا الدور (turn)؟
 *
 * - 'system' = الـ NPC (الطبيب، النادل، إلخ). الجملة تظهر و تُقرأ تلقائياً.
 * - 'user'   = أنت. عليك ترتيب الكلمات.
 *
 * 🎯 مفهوم تقني (Discriminated Union):
 *   يمكن لـ TypeScript أن يميز بين الحالتين عبر هذا الحقل،
 *   فيعرف ما يمكن استخدامه في كل دور.
 */
export type Speaker = 'system' | 'user';

/**
 * دور واحد في المحادثة.
 *
 * كلا النوعين (system و user) يحملان نفس البيانات الأساسية:
 *   - germanWords: الجملة الألمانية الكاملة (بنفس شكل sentence.model.ts)
 *   - english:    الترجمة للمساعدة
 *   - hint:       تلميح اختياري
 *
 * الفرق فقط في كيف نعرضها في الواجهة (display logic).
 */
export interface ConversationTurn {
  speaker: Speaker;
  germanWords: string[];      // الكلمات الألمانية بالترتيب الصحيح
  english: string;            // الترجمة (للمساعدة في فهم المعنى)
  hint?: string;              // تلميح اختياري (للـ user turns)
}

/**
 * محادثة كاملة (سيناريو من الحياة).
 *
 * مثال:
 *   id: 'doctor-headache'
 *   context: 'doctor'
 *   title: 'Visiting the doctor for a headache'
 *   turns: [
 *     { speaker: 'system', germanWords: ['Guten', 'Tag.', 'Wie', 'kann', 'ich', 'Ihnen', 'helfen?'], english: 'Hello. How can I help you?' },
 *     { speaker: 'user',   germanWords: ['Ich', 'habe', 'seit', 'drei', 'Tagen', 'Kopfschmerzen.'], english: 'I have had a headache for three days.' },
 *     ...
 *   ]
 */
export interface Conversation {
  id: string;                 // معرّف فريد (string، أوضح من number)
  context: string;            // 'doctor' / 'shopping' / ... (للتجميع)
  contextEmoji: string;       // '🏥' / '🛒' / ...
  contextTitle: string;       // 'At the Doctor' / 'Shopping' / ...
  title: string;              // اسم المحادثة المحدّد
  description: string;        // وصف السيناريو (يظهر قبل البدء)
  level: LevelCode;           // المستوى التقريبي (للفلتر مستقبلاً)
  turns: ConversationTurn[];  // الأدوار بالترتيب
}
