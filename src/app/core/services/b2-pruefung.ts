import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { B2Pruefungscurriculum, B2Sitzung } from '../models/b2-pruefung.model';

/**
 * B2PruefungService — يحمّل curriculum تحضير B2 من JSON (lazy, مرّة واحدة).
 */
@Injectable({ providedIn: 'root' })
export class B2PruefungService {
  private http = inject(HttpClient);

  private readonly _data = signal<B2Pruefungscurriculum | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal(false);

  readonly data = this._data.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly loaded = computed(() => this._data() !== null);
  readonly sitzungen = computed<B2Sitzung[]>(() => this._data()?.sitzungen ?? []);

  constructor() { this.load(); }

  getSitzung(id: string): B2Sitzung | null {
    return this._data()?.sitzungen.find(s => s.id === id) ?? null;
  }

  retry() { if (!this.loaded()) this.load(); }

  private load(): void {
    if (this._loading() || this.loaded()) return;
    this._loading.set(true);
    this._error.set(false);
    this.http.get<B2Pruefungscurriculum>('/data/b2-pruefung.json').subscribe({
      next: d => { this._data.set(d); this._loading.set(false); },
      error: () => { this._error.set(true); this._loading.set(false); },
    });
  }
}
