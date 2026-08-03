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
