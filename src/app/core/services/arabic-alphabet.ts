import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AlphabetLetter, ArabicAlphabetData } from '../models/arabic-alphabet.model';

/**
 * ArabicAlphabetService — يحمّل الأبجدية العربية الغنيّة بالأمثلة.
 */
@Injectable({ providedIn: 'root' })
export class ArabicAlphabetService {
  private http = inject(HttpClient);

  private readonly _data = signal<ArabicAlphabetData | null>(null);
  private readonly _loaded = signal(false);

  readonly loaded = this._loaded.asReadonly();
  readonly letters = computed<AlphabetLetter[]>(() => this._data()?.letters ?? []);

  /** حرف عبر id */
  letterById(id: string) {
    return computed(() => this.letters().find(l => l.id === id));
  }

  /** بحث حرف + الفهرس + السابق/التالي */
  letterLookup(id: string) {
    return computed(() => {
      const list = this.letters();
      const index = list.findIndex(l => l.id === id);
      if (index === -1) return null;
      return {
        letter: list[index],
        index,
        prev: list[index - 1] ?? null,
        next: list[index + 1] ?? null,
      };
    });
  }

  constructor() {
    this.http.get<ArabicAlphabetData>('/data/arabic-alphabet.json').subscribe({
      next: (d) => { this._data.set(d); this._loaded.set(true); },
      error: (e) => { console.error('Failed to load alphabet:', e); this._loaded.set(true); },
    });
  }
}
