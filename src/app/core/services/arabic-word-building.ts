import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ArabicWordBuildingData, LetterInfo, WordBuilding } from '../models/arabic-word-building.model';

/**
 * جدول معلومات الأحرف العربية — اسم + صوت + تشبيه ألماني.
 * يشمل كل الأحرف الـ28 + المتغيّرات (همزة، ألف مقصورة، تاء مربوطة…).
 */
const LETTER_INFO: Record<string, LetterInfo> = {
  // 28 Buchstaben
  'ا': { name: 'Alif', sound: 'ā / a', hint: 'langes A' },
  'ب': { name: 'Bā', sound: 'b', hint: 'wie deutsch B' },
  'ت': { name: 'Tā', sound: 't', hint: 'wie deutsch T' },
  'ث': { name: 'Thā', sound: 'th', hint: 'wie engl. th in think' },
  'ج': { name: 'Jīm', sound: 'dsch / j', hint: 'Dschungel / franz. j' },
  'ح': { name: 'Ḥā', sound: 'ḥ', hint: 'gehauchtes H aus der Kehle' },
  'خ': { name: 'Khā', sound: 'ch', hint: 'wie ch in Bach' },
  'د': { name: 'Dāl', sound: 'd', hint: 'wie deutsch D' },
  'ذ': { name: 'Dhāl', sound: 'dh', hint: 'wie engl. th in this' },
  'ر': { name: 'Rā', sound: 'r', hint: 'gerolltes R' },
  'ز': { name: 'Zāy', sound: 'z', hint: 'stimmhaftes z (zebra)' },
  'س': { name: 'Sīn', sound: 's', hint: 'wie ß / scharfes s' },
  'ش': { name: 'Shīn', sound: 'sch', hint: 'wie deutsch sch' },
  'ص': { name: 'Ṣād', sound: 'ṣ', hint: 'emphatisches S' },
  'ض': { name: 'Ḍād', sound: 'ḍ', hint: 'emphatisches D' },
  'ط': { name: 'Ṭā', sound: 'ṭ', hint: 'emphatisches T' },
  'ظ': { name: 'Ẓā', sound: 'ẓ', hint: 'emphatisches DH' },
  'ع': { name: 'ʿAyn', sound: 'ʿ', hint: 'Kehllaut — sehr arabisch' },
  'غ': { name: 'Ghayn', sound: 'gh', hint: 'wie franz. gerolltes R' },
  'ف': { name: 'Fā', sound: 'f', hint: 'wie deutsch F' },
  'ق': { name: 'Qāf', sound: 'q', hint: 'tiefes K im Rachen' },
  'ك': { name: 'Kāf', sound: 'k', hint: 'wie deutsch K' },
  'ل': { name: 'Lām', sound: 'l', hint: 'wie deutsch L' },
  'م': { name: 'Mīm', sound: 'm', hint: 'wie deutsch M' },
  'ن': { name: 'Nūn', sound: 'n', hint: 'wie deutsch N' },
  'ه': { name: 'Hā', sound: 'h', hint: 'wie deutsch H' },
  'و': { name: 'Wāw', sound: 'w / ū', hint: 'wie engl. w oder langes uu' },
  'ي': { name: 'Yā', sound: 'y / ī', hint: 'wie deutsch J oder langes ii' },
  // Varianten
  'أ': { name: 'Alif (Hamza oben)', sound: 'a', hint: 'Alif mit Hamza obenauf — kurzer a-Anfang' },
  'إ': { name: 'Alif (Hamza unten)', sound: 'i', hint: 'Alif mit Hamza unten — kurzer i-Anfang' },
  'آ': { name: 'Alif Madda', sound: 'ā', hint: 'langer A-Anfang' },
  'ى': { name: 'Alif maqsūra', sound: 'ā am Ende', hint: 'wie A am Wortende' },
  'ة': { name: 'Tā marbūṭa', sound: 'a / -at', hint: 'weibliche Endung' },
  'ء': { name: 'Hamza', sound: 'ʾ', hint: 'Knacklaut (wie in Beʾamten)' },
  'ئ': { name: 'Hamza auf Yāʾ', sound: 'ʾ', hint: 'Hamza, getragen von Yāʾ' },
  'ؤ': { name: 'Hamza auf Wāw', sound: 'ʾ', hint: 'Hamza, getragen von Wāw' },
};

/** Standard-Fallback wenn ein Zeichen nicht in der Tabelle ist */
const FALLBACK: LetterInfo = { name: '?', sound: '?', hint: '' };

@Injectable({ providedIn: 'root' })
export class ArabicWordBuildingService {
  private http = inject(HttpClient);

  private readonly _data = signal<ArabicWordBuildingData | null>(null);
  private readonly _loaded = signal(false);

  readonly loaded = this._loaded.asReadonly();
  readonly words = computed<WordBuilding[]>(() => this._data()?.words ?? []);

  wordById(id: string) {
    return computed(() => this.words().find(w => w.id === id));
  }

  /** بحث كلمة + الفهرس + السابقة/التالية */
  wordLookup(id: string) {
    return computed(() => {
      const list = this.words();
      const index = list.findIndex(w => w.id === id);
      if (index === -1) return null;
      return { word: list[index], index, prev: list[index - 1] ?? null, next: list[index + 1] ?? null };
    });
  }

  /** كلمات مُجمَّعة حسب الصعوبة */
  readonly byDifficulty = computed(() => {
    const out: Record<number, WordBuilding[]> = { 1: [], 2: [], 3: [] };
    for (const w of this.words()) out[w.difficulty].push(w);
    return out;
  });

  /** معلومات حرف */
  infoFor(letter: string): LetterInfo {
    return LETTER_INFO[letter] ?? FALLBACK;
  }

  constructor() {
    this.http.get<ArabicWordBuildingData>('/data/arabic-word-building.json').subscribe({
      next: (d) => { this._data.set(d); this._loaded.set(true); },
      error: (e) => { console.error('Failed to load word-building data:', e); this._loaded.set(true); },
    });
  }
}
