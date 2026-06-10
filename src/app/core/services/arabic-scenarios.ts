import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ArabicScenariosData, Category, Scenario } from '../models/arabic-scenarios.model';

const DONE_KEY = 'deutsch-learn:arabic-scenarios-done';

/**
 * ArabicScenariosService — يحمّل المواقف و يحفظ التقدّم.
 *
 * ملاحظة: التطبيق موحّد بلا فصل بين الفصحى و السورية —
 * تظهر الصيغتان معاً دائماً داخل كل خطوة.
 */
@Injectable({ providedIn: 'root' })
export class ArabicScenariosService {
  private http = inject(HttpClient);

  private readonly _data = signal<ArabicScenariosData | null>(null);
  private readonly _loaded = signal(false);

  readonly loaded = this._loaded.asReadonly();
  readonly categories = computed<Category[]>(() => this._data()?.categories ?? []);
  readonly scenarios = computed<Scenario[]>(() => this._data()?.scenarios ?? []);

  scenarioById(id: string) {
    return computed(() => this.scenarios().find(s => s.id === id));
  }

  /** مواقف مُجمَّعة حسب الفئة */
  readonly scenariosByCategory = computed(() => {
    const out: Record<string, Scenario[]> = {};
    for (const s of this.scenarios()) (out[s.categoryId] ??= []).push(s);
    return out;
  });

  // ───────── التقدّم ─────────
  private readonly _doneIds = signal<Set<string>>(this.loadDone());
  readonly doneIds = this._doneIds.asReadonly();

  isDone(scenarioId: string): boolean { return this._doneIds().has(scenarioId); }
  markDone(scenarioId: string): void {
    if (this._doneIds().has(scenarioId)) return;
    this._doneIds.update(s => new Set(s).add(scenarioId));
  }
  unmarkDone(scenarioId: string): void {
    this._doneIds.update(s => { const n = new Set(s); n.delete(scenarioId); return n; });
  }

  constructor() {
    this.http.get<ArabicScenariosData>('/data/arabic-scenarios.json').subscribe({
      next: (d) => { this._data.set(d); this._loaded.set(true); },
      error: (e) => { console.error('Failed to load scenarios:', e); this._loaded.set(true); },
    });
    effect(() => this.save(DONE_KEY, [...this._doneIds()]));
  }

  private loadDone(): Set<string> {
    try {
      const raw = localStorage.getItem(DONE_KEY);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch { return new Set(); }
  }
  private save(key: string, value: unknown): void {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { console.warn(`Failed to save (${key}):`, e); }
  }
}
