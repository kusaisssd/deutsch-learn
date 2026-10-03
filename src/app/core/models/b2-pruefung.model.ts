/**
 * B2 Prüfungscurriculum — بنية الدرس مطابقة لـ Lehrwerke الألمانيّة
 * (Aspekte Neu / Sicher! / Mittelpunkt / Begegnungen B2).
 *
 * كل Sitzung = جلسة واحدة (~90-120 دقيقة) تغطّي خمسة أقسام رئيسيّة.
 */

export interface B2Vocab {
  de: string;
  ar: string;
  beispiel?: string;
}

export interface B2Frage {
  frage: string;
  antwort: string;  // الجواب النموذجي أو الحلّ
}

export interface B2Uebung {
  nummer?: string;        // «Ü1», «Ü2», …
  titel?: string;
  anweisung: string;      // «Setzen Sie die richtige Form ein»
  saetze: {
    aufgabe: string;      // الجملة ذات الفراغ
    loesung: string;      // الحلّ
    hinweis?: string;     // تلميح نحوي
  }[];
}

export interface B2Lesetext {
  titel: string;
  quelle: string;         // الناشر الوهمي («aus einem Magazin», «Blog»)
  text: string;           // Lesetext الأصلي
  wortzahl?: number;
  fragen: B2Frage[];
}

export interface B2Hoertext {
  titel: string;
  format: string;         // «Interview», «Nachrichtenmeldung», …
  transkript: string;
  fragen: B2Frage[];
}

export interface B2Grammatik {
  thema: string;          // «Konjunktiv II höflich»
  erklaerung: string;     // شرح نحوي كامل
  formtabelle?: {         // جدول اختياري
    kopf: string[];
    zeilen: string[][];
  };
  beispielsaetze: string[];
  pruefungstipp?: string;
  uebungen: B2Uebung[];
}

export interface B2Redemittel {
  titel: string;          // «Meinung ausdrücken»
  phrasen: string[];
}

export interface B2Sprechen {
  anlass: string;         // «Prüfungsteil 1 – Vortrag»
  thema: string;
  anweisung: string;
  redemittel: B2Redemittel[];
  aufgabe: string;
}

export interface B2Schreiben {
  textsorte: string;      // «Formelle E-Mail», «Erörterung»
  anlass: string;
  aufgabenstellung: string;
  wortzahl: number;       // عدد الكلمات المطلوبة
  aufbau: string[];       // خطوات بناء النصّ
  mustertext: string;     // نموذج كامل
  bewertungskriterien?: string[];
}

export interface B2TeilA {
  typ: 'wortschatz_lesen';
  titel: string;
  lesetext: B2Lesetext;
  wortschatzliste: B2Vocab[];
}

export interface B2TeilB {
  typ: 'grammatik';
  titel: string;
  grammatik: B2Grammatik;
}

export interface B2TeilC {
  typ: 'hoeren';
  titel: string;
  hoertext: B2Hoertext;
}

export interface B2TeilD {
  typ: 'sprechen';
  titel: string;
  sprechen: B2Sprechen;
}

export interface B2TeilE {
  typ: 'schreiben';
  titel: string;
  schreiben: B2Schreiben;
}

export type B2Teil = B2TeilA | B2TeilB | B2TeilC | B2TeilD | B2TeilE;

export interface B2Einstieg {
  bildEmoji: string;       // emoji محوري (⚡ لا نحتاج روابط خارجيّة)
  farbe: string;           // اسم لون Tailwind: indigo/emerald/rose/…
  fragen: string[];        // أسئلة تمهيديّة
  assoziationen: string[]; // كلمات مرتبطة بالموضوع
}

export interface B2Abschluss {
  lernwortschatz: string[];       // قائمة مفردات نهائيّة
  grammatikZusammenfassung: string;
  pruefungstipp: string;
  projekt: string;                // مهمّة عمليّة
}

export interface B2Sitzung {
  id: string;                     // «s1», «s2», …
  nummer: number;
  titelDe: string;
  titelAr: string;
  dauer: string;                  // «90 Min», «2 × 45 Min»
  pruefungsbezug: string;         // «Lesen Teil 2» etc.
  einstieg: B2Einstieg;
  lernziele: string[];
  teile: B2Teil[];
  abschluss: B2Abschluss;
}

export interface B2Pruefungscurriculum {
  level: string;
  titelDe: string;
  titelAr: string;
  beschreibung: string;
  sitzungen: B2Sitzung[];
}
