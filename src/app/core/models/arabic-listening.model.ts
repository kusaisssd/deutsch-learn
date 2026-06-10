import { ArabicForm } from './arabic-scenarios.model';

/** تمرين استماع: جملة/مقطع + سؤال فهم */
export interface ListeningPassage {
  id: string;
  level: 1 | 2 | 3;
  emoji: string;
  title: string;            // ألماني
  fusha: ArabicForm;
  syrian: ArabicForm;
  de: string;               // الترجمة الألمانية
  question: string;         // سؤال بالألمانية
  options: string[];        // إجابات بالألمانية
  correct: number;
  explanation: string;
}

export interface ArabicListeningData {
  passages: ListeningPassage[];
}
