import { Injectable, computed, effect, signal } from '@angular/core';
import { LevelCode } from '../models/level.model';

/**
 * مفتاح التخزين في localStorage.
 * نستخدم prefix كي لا نتعارض مع تطبيقات أخرى على نفس النطاق.
 */
const STORAGE_KEY = 'deutsch-learn:completed-sentences';

/**
 * ProgressService — حفظ تقدم المستخدم محلياً.
 *
 * المسؤوليات:
 *   - تذكّر معرّفات الجمل التي أنجزها المستخدم.
 *   - حفظ التغييرات تلقائياً في localStorage.
 *   - عرض signals للقراءة (هل الجملة منجزة؟ كم جملة منجزة في مستوى؟).
 *
 * 🎯 ميزة effect():
 *   نراقب الـ signal، و كلما تغيّر → نكتب في localStorage تلقائياً.
 *   مثل INotifyPropertyChanged في WPF، أو change tracker في EF.
 *
 * مقابل في ASP.NET:
 *   public interface IProgressStore {
 *     ISet<int> CompletedIds { get; }
 *     void MarkCompleted(int id);
 *     bool IsCompleted(int id);
 *   }
 *   لكن هنا التخزين في localStorage بدل DB.
 */
@Injectable({ providedIn: 'root' })
export class ProgressService {
  /**
   * مجموعة (Set) معرّفات الجمل المنجزة.
   * Set أسرع من Array لـ .has() (O(1) بدل O(n)).
   *
   * private لأننا نريد التحكم بالكتابة (عبر markCompleted/reset فقط).
   */
  private readonly _completedIds = signal<Set<number>>(this.loadFromStorage());

  // ───────── public readonly API ─────────

  /** نسخة للقراءة للخارج (signal من Set) */
  readonly completedIds = this._completedIds.asReadonly();

  /** عدد كل الجمل المنجزة (computed عام مفيد للإحصائيات) */
  readonly totalCompleted = computed(() => this._completedIds().size);

  // ───────── constructor: حفظ تلقائي ─────────

  constructor() {
    /**
     * effect() = "كلما تغيّر signal داخلي، نفّذ هذا الكود".
     *
     * هنا: كلما تغيّر _completedIds → نحفظ في localStorage.
     * النتيجة: لا نحتاج استدعاء saveToStorage يدوياً في كل مكان.
     */
    effect(() => {
      const ids = this._completedIds();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
      } catch (e) {
        console.warn('فشل الحفظ في localStorage:', e);
      }
    });
  }

  // ───────── Actions ─────────

  /** هل الجملة منجزة؟ */
  isCompleted(sentenceId: number): boolean {
    return this._completedIds().has(sentenceId);
  }

  /** تأشير جملة كمنجزة. لا يكرّر لو كانت موجودة. */
  markCompleted(sentenceId: number): void {
    if (this._completedIds().has(sentenceId)) return;
    // مهم: ننشئ Set جديد (immutability) كي يكتشف signal التغيير
    this._completedIds.update(s => new Set(s).add(sentenceId));
  }

  /** إزالة جملة من المنجزة (مفيد لو أردنا زر "reset") */
  unmarkCompleted(sentenceId: number): void {
    if (!this._completedIds().has(sentenceId)) return;
    this._completedIds.update(s => {
      const next = new Set(s);
      next.delete(sentenceId);
      return next;
    });
  }

  /** مسح كل التقدم */
  resetAll(): void {
    this._completedIds.set(new Set());
  }

  /**
   * كم جملة منجزة من قائمة (لمستوى معين مثلاً).
   * نمرّر قائمة معرّفات و نُرجع كم منها منجز.
   *
   * مثال:
   *   countCompletedAmong([1, 2, 3, 4, 5]) → 3 (لو 1, 2, 4 منجزة)
   */
  countCompletedAmong(sentenceIds: readonly number[]): number {
    const completed = this._completedIds();
    return sentenceIds.filter(id => completed.has(id)).length;
  }

  // ───────── خاص: تحميل من التخزين عند البدء ─────────

  /**
   * يقرأ المعرّفات المحفوظة عند بناء الـ service.
   * لو لم يوجد شيء أو فيه خطأ → نُرجع Set فارغة.
   */
  private loadFromStorage(): Set<number> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return new Set();
      const arr = JSON.parse(raw) as number[];
      return new Set(arr);
    } catch {
      return new Set();
    }
  }
}
