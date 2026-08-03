/** استجابة Claude AI للبحث عن كلمة */
export interface ClaudeLookupResult {
  word: string;
  type: 'noun' | 'verb' | 'adjective' | 'adverb' | 'phrase' | 'other';
  article: 'der' | 'die' | 'das' | null;
  arabicTranslation: string;
  meanings: { de: string; ar: string }[];
  examples: { de: string; ar: string }[];
  grammar: string | null;
  synonyms: string[];
  usage: string | null;
}

export interface ClaudeLookupError {
  error: string;
  detail?: string;
}

/** استجابة الشرح الأعمق (mode=deep) */
export interface ClaudeDeepResult {
  word: string;
  deeperExamples: { de: string; ar: string; context?: string }[];
  culturalContext: string | null;
  commonMistakes: string | null;
  relatedPhrases: { de: string; ar: string }[];
}

/** استجابة سؤال حرّ (mode=ask) — نص عربي واحد */
export interface ClaudeAskResult {
  answer: string;
}

/** سؤال محفوظ ضمن سجلّ الكلمة */
export interface DictAsk {
  q: string;    // نص السؤال (عربي)
  a: string;    // جواب Claude
  ts: number;   // متى جاء الجواب
  preset?: string; // معرّف الطلب الجاهز إن وُجد (explain, examples, …)
}
