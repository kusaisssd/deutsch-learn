/** تحليل Claude لنصّ ألماني — يُرجَع كـ JSON من /api/claude-lookup?mode=analyze */

export interface TAPhrase {
  phrase: string;      // العبارة الكاملة بالألماني
  ar: string;          // الترجمة العربيّة
  erklaerungAr?: string; // شرح استعمالها إن لزم
  satz?: string;       // الجملة الكاملة من النصّ (السياق)
}

export interface TAWord {
  wort: string;        // الكلمة بالألماني
  artikel?: string;    // der/die/das (للأسماء فقط)
  ar: string;          // الترجمة
  satz?: string;       // الجملة من النصّ
}

export interface TAVerb {
  infinitiv: string;   // لعب → spielen
  partizip?: string;   // gespielt
  praeposition?: string; // sprechen über (A)
  ar: string;
  satz?: string;
}

export interface TAGrammatik {
  thema: string;       // «Passiv», «Konjunktiv II»
  erklaerungAr: string; // شرح مختصر عربي
}

export interface TAHinweis {
  typ: string;         // «False Friend», «Besonderheit», «Umgangssprache»
  beschreibung: string; // عربي
}

export interface TAFrage {
  frage: string;       // عربي
  antwort: string;     // عربي
}

/** الناتج الكامل من /api/claude-lookup?mode=analyze */
export interface TextAnalysis {
  zusammenfassung: string;  // ملخّص عربي قصير
  textsorte: string;        // «Nachrichtentext», «Blogbeitrag», «Dialog», …
  niveau: 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
  wortzahl?: number;
  redewendungen: TAPhrase[];
  schluesselwoerter: TAWord[];
  verben: TAVerb[];
  grammatikfokus: TAGrammatik;
  hinweise: TAHinweis[];
  verstaendnisfragen: TAFrage[];
  lernziele: string[];      // 2-3 أهداف عربي
}

/** درس محفوظ محلياً */
export interface SavedLesson {
  id: string;              // uuid
  erstelltAm: number;      // Date.now()
  originaltext: string;    // النصّ الأصلي
  titel: string;           // عنوان مختصر مُستنتَج
  analyse: TextAnalysis;
}
