import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { WritingData, WritingTask } from '../models/writing.model';

/**
 * مفاتيح التخزين المحلي.
 *   - DRAFTS: مسوّدات نصوص المستخدم لكل تمرين { taskId: text }
 *   - DONE:  معرّفات التمارين التي أشّرها المستخدم كمنجزة
 *
 * نحفظ المسوّدة تلقائياً حتى لا يضيع ما كتبه المستخدم عند التحديث —
 * نفس درس «حفظ التقدّم» الذي طبّقناه في ProgressService.
 */
const DRAFTS_KEY = 'deutsch-learn:writing-drafts';
const DONE_KEY = 'deutsch-learn:writing-done';

/**
 * WritingService — يحمّل تمارين الكتابة + دليل الترابط من writing.json،
 * و يحفظ مسوّدات المستخدم و التمارين المنجزة محلياً.
 *
 * نفس نمط CoursesService (تحميل JSON + signals) مع إضافة طبقة حفظ
 * مثل ProgressService (effects → localStorage).
 */
@Injectable({ providedIn: 'root' })
export class WritingService {
  private http = inject(HttpClient);

  // ───────── بيانات JSON ─────────
  private readonly _data = signal<WritingData | null>(null);
  private readonly _loaded = signal(false);

  readonly loaded = this._loaded.asReadonly();
  readonly tasks = computed<WritingTask[]>(() => this._data()?.tasks ?? []);
  readonly guide = computed(() => this._data()?.guide ?? null);

  /** تمرين واحد عبر id */
  taskById(id: string) {
    return computed(() => this.tasks().find(t => t.id === id));
  }

  /** التمارين مُجمَّعة حسب النوع (للعرض في القائمة) */
  readonly tasksByKind = computed(() => {
    const groups: Record<string, WritingTask[]> = { opinion: [], story: [], graph: [] };
    for (const t of this.tasks()) (groups[t.kind] ??= []).push(t);
    return groups;
  });

  // ───────── مسوّدات المستخدم ─────────
  private readonly _drafts = signal<Record<string, string>>(this.loadDrafts());
  readonly drafts = this._drafts.asReadonly();

  /** مسوّدة تمرين معيّن (نص أو سلسلة فارغة) */
  draftFor(id: string) {
    return computed(() => this._drafts()[id] ?? '');
  }

  /** حفظ/تحديث مسوّدة تمرين */
  setDraft(id: string, text: string): void {
    this._drafts.update(d => ({ ...d, [id]: text }));
  }

  // ───────── التمارين المنجزة ─────────
  private readonly _doneIds = signal<Set<string>>(this.loadDone());
  readonly doneIds = this._doneIds.asReadonly();

  isDone(id: string): boolean {
    return this._doneIds().has(id);
  }

  markDone(id: string): void {
    if (this._doneIds().has(id)) return;
    this._doneIds.update(s => new Set(s).add(id));
  }

  unmarkDone(id: string): void {
    if (!this._doneIds().has(id)) return;
    this._doneIds.update(s => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
  }

  constructor() {
    this.http.get<WritingData>('/data/writing.json').subscribe({
      next: (data) => {
        this._data.set(data);
        this._loaded.set(true);
      },
      error: (err) => {
        console.error('Failed to load writing tasks:', err);
        this._loaded.set(true);
      },
    });

    // حفظ تلقائي عند أي تغيير
    effect(() => this.save(DRAFTS_KEY, this._drafts()));
    effect(() => this.save(DONE_KEY, [...this._doneIds()]));
  }

  // ───────── helpers ─────────
  private loadDrafts(): Record<string, string> {
    try {
      const raw = localStorage.getItem(DRAFTS_KEY);
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      return {};
    }
  }

  private loadDone(): Set<string> {
    try {
      const raw = localStorage.getItem(DONE_KEY);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
      return new Set();
    }
  }

  private save(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn(`Failed to save to localStorage (${key}):`, e);
    }
  }
}
