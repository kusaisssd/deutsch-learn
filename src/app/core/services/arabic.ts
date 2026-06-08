import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ArabicCategory, ArabicData } from '../models/arabic.model';

/**
 * ArabicService — يحمّل بيانات «تعلم العربية» من arabic-words.json.
 *
 * مثل بقية الخدمات: signal للقراءة، loaded flag، helper للبحث عن قسم.
 */
@Injectable({ providedIn: 'root' })
export class ArabicService {
  private http = inject(HttpClient);

  private readonly _data = signal<ArabicData | null>(null);
  private readonly _loaded = signal(false);

  readonly loaded = this._loaded.asReadonly();
  readonly categories = computed<ArabicCategory[]>(() => this._data()?.categories ?? []);
  readonly pronunciationKey = computed(() => this._data()?.pronunciationKey ?? []);

  /** قسم واحد عبر id */
  categoryById(id: string) {
    return computed(() => this.categories().find(c => c.id === id));
  }

  constructor() {
    this.http.get<ArabicData>('/data/arabic-words.json').subscribe({
      next: (d) => { this._data.set(d); this._loaded.set(true); },
      error: (err) => {
        console.error('Failed to load arabic words:', err);
        this._loaded.set(true);
      },
    });
  }
}
