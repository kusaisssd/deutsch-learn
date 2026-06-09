import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ArabicScenariosData, Category, LearnPath, Scenario } from '../models/arabic-scenarios.model';

const DONE_KEY = 'deutsch-learn:arabic-scenarios-done';
const PATH_KEY = 'deutsch-learn:arabic-learn-path';
const COMPARE_KEY = 'deutsch-learn:arabic-compare-default';

/**
 * ArabicScenariosService — يحمّل المواقف و يحفظ التقدّم + تفضيل المسار.
 *
 * - مساران: fusha أو syrian. يُحفَظ التفضيل في localStorage فلا يضيع.
 * - كل موقف قد يكون متاحاً في كلا المسارين (الافتراضي) أو في واحد فقط.
 * - تقدّم: تأشير الموقف كمنجَز (مفتاح: pathId::scenarioId — لأن الموقف
 *   نفسه قد يُكمَل في كلا المسارين).
 */
@Injectable({ providedIn: 'root' })
export class ArabicScenariosService {
  private http = inject(HttpClient);

  private readonly _data = signal<ArabicScenariosData | null>(null);
  private readonly _loaded = signal(false);

  readonly loaded = this._loaded.asReadonly();
  readonly categories = computed<Category[]>(() => this._data()?.categories ?? []);
  readonly scenarios = computed<Scenario[]>(() => this._data()?.scenarios ?? []);

  // ───────── تفضيل المسار + المقارنة الافتراضية ─────────
  private readonly _path = signal<LearnPath | null>(this.loadPath());
  /** المسار المُختار حالياً (null = لم يَختر بعد، تظهر صفحة الاختيار) */
  readonly currentPath = this._path.asReadonly();

  setPath(p: LearnPath) { this._path.set(p); }
  resetPath() { this._path.set(null); }

  /** هل المقارنة (إظهار المسار الآخر) مفعّلة افتراضياً؟ */
  private readonly _compareDefault = signal<boolean>(this.loadCompare());
  readonly compareDefault = this._compareDefault.asReadonly();
  setCompareDefault(on: boolean) { this._compareDefault.set(on); }

  // ───────── المواقف ─────────
  scenarioById(id: string) {
    return computed(() => this.scenarios().find(s => s.id === id));
  }

  /** مواقف متاحة لمسار معيّن */
  scenariosForPath(path: LearnPath) {
    return computed(() => this.scenarios().filter(s => !s.paths || s.paths.includes(path)));
  }

  /** مواقف مُجمَّعة حسب الفئة لمسار معيّن */
  scenariosByCategoryForPath(path: LearnPath) {
    return computed(() => {
      const out: Record<string, Scenario[]> = {};
      for (const s of this.scenariosForPath(path)()) (out[s.categoryId] ??= []).push(s);
      return out;
    });
  }

  // ───────── التقدّم ─────────
  private readonly _doneKeys = signal<Set<string>>(this.loadDone());
  readonly doneKeys = this._doneKeys.asReadonly();

  private composeKey(path: LearnPath, scenarioId: string) {
    return `${path}::${scenarioId}`;
  }
  isDone(path: LearnPath, scenarioId: string): boolean {
    return this._doneKeys().has(this.composeKey(path, scenarioId));
  }
  markDone(path: LearnPath, scenarioId: string): void {
    const k = this.composeKey(path, scenarioId);
    if (this._doneKeys().has(k)) return;
    this._doneKeys.update(s => new Set(s).add(k));
  }
  unmarkDone(path: LearnPath, scenarioId: string): void {
    this._doneKeys.update(s => {
      const next = new Set(s);
      next.delete(this.composeKey(path, scenarioId));
      return next;
    });
  }

  constructor() {
    this.http.get<ArabicScenariosData>('/data/arabic-scenarios.json').subscribe({
      next: (d) => { this._data.set(d); this._loaded.set(true); },
      error: (e) => { console.error('Failed to load scenarios:', e); this._loaded.set(true); },
    });
    effect(() => this.save(DONE_KEY, [...this._doneKeys()]));
    effect(() => this.save(PATH_KEY, this._path()));
    effect(() => this.save(COMPARE_KEY, this._compareDefault()));
  }

  private loadDone(): Set<string> {
    try {
      const raw = localStorage.getItem(DONE_KEY);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch { return new Set(); }
  }
  private loadPath(): LearnPath | null {
    try {
      const raw = localStorage.getItem(PATH_KEY);
      return raw ? (JSON.parse(raw) as LearnPath | null) : null;
    } catch { return null; }
  }
  private loadCompare(): boolean {
    try {
      const raw = localStorage.getItem(COMPARE_KEY);
      return raw ? Boolean(JSON.parse(raw)) : false;
    } catch { return false; }
  }
  private save(key: string, value: unknown): void {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { console.warn(`Failed to save (${key}):`, e); }
  }
}
