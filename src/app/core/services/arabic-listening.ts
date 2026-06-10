import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ArabicListeningData, ListeningPassage } from '../models/arabic-listening.model';

@Injectable({ providedIn: 'root' })
export class ArabicListeningService {
  private http = inject(HttpClient);

  private readonly _data = signal<ArabicListeningData | null>(null);
  private readonly _loaded = signal(false);

  readonly loaded = this._loaded.asReadonly();
  readonly passages = computed<ListeningPassage[]>(() => this._data()?.passages ?? []);

  readonly byLevel = computed(() => {
    const out: Record<number, ListeningPassage[]> = { 1: [], 2: [], 3: [] };
    for (const p of this.passages()) out[p.level].push(p);
    return out;
  });

  constructor() {
    this.http.get<ArabicListeningData>('/data/arabic-listening.json').subscribe({
      next: (d) => { this._data.set(d); this._loaded.set(true); },
      error: (e) => { console.error('Failed to load listening:', e); this._loaded.set(true); },
    });
  }
}
