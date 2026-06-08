import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ArabicCourse, ArabicLektion } from '../models/arabic-course.model';

const COMPLETED_KEY = 'deutsch-learn:completed-arabic-lektionen';

/**
 * ArabicCourseService — يحمّل منهج «Arabisch lernen» و يتتبّع التقدّم.
 *
 * تقدّم مستقلّ عن ProgressService (مفتاح localStorage خاص) لتفادي تشابك
 * أنواع المعرّفات.
 */
@Injectable({ providedIn: 'root' })
export class ArabicCourseService {
  private http = inject(HttpClient);

  private readonly _course = signal<ArabicCourse | null>(null);
  private readonly _loaded = signal(false);

  readonly loaded = this._loaded.asReadonly();
  readonly course = this._course.asReadonly();
  readonly lektionen = computed<ArabicLektion[]>(() => this._course()?.lektionen ?? []);

  // ───────── progress ─────────
  private readonly _doneIds = signal<Set<string>>(this.loadDone());
  readonly doneIds = this._doneIds.asReadonly();

  isDone(id: string): boolean { return this._doneIds().has(id); }
  markDone(id: string): void {
    if (this._doneIds().has(id)) return;
    this._doneIds.update(s => new Set(s).add(id));
  }
  unmarkDone(id: string): void {
    this._doneIds.update(s => { const n = new Set(s); n.delete(id); return n; });
  }

  /** بحث لدرس + الفهرس + السابق/التالي */
  lektionLookup(id: string) {
    return computed(() => {
      const list = this.lektionen();
      const index = list.findIndex(l => l.id === id);
      if (index === -1) return null;
      return {
        lektion: list[index],
        index,
        prev: list[index - 1] ?? null,
        next: list[index + 1] ?? null,
      };
    });
  }

  /**
   * حالة كل درس (مفتوح/مغلق/منجز) — نفس نموذج المنهج الألماني.
   * الدرس الأول مفتوح دائماً، و باقي الدروس تُفتح فقط بعد إنجاز السابق.
   */
  readonly lektionStates = computed(() => {
    const list = this.lektionen();
    return list.map((l, i) => {
      const done = this.isDone(l.id);
      const unlocked = i === 0 || this.isDone(list[i - 1].id);
      const isNext = !done && unlocked && !(i > 0 && this.isDone(list[i - 1].id) && this.isDone(l.id));
      return { lektion: l, done, unlocked, isNext };
    });
  });

  constructor() {
    this.http.get<ArabicCourse>('/data/arabic-course.json').subscribe({
      next: (c) => { this._course.set(c); this._loaded.set(true); },
      error: (e) => { console.error('Failed to load arabic course:', e); this._loaded.set(true); },
    });
    effect(() => this.save(COMPLETED_KEY, [...this._doneIds()]));
  }

  private loadDone(): Set<string> {
    try {
      const raw = localStorage.getItem(COMPLETED_KEY);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch { return new Set(); }
  }

  private save(key: string, value: unknown): void {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (e) { console.warn(`Failed to save (${key}):`, e); }
  }
}
