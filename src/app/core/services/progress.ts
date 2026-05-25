import { Injectable, computed, effect, signal } from '@angular/core';

/**
 * مفاتيح التخزين في localStorage (prefix يمنع التعارض مع تطبيقات أخرى).
 *
 * مفتاحان منفصلان:
 *   - الجمل (number ids)
 *   - المحادثات (string ids مثل 'doctor-headache')
 *
 * فصلهما يحمي من الكسر لو تغيّر شكل أحدهما.
 */
const SENTENCES_KEY = 'deutsch-learn:completed-sentences';
const CONVERSATIONS_KEY = 'deutsch-learn:completed-conversations';
const LEKTIONEN_KEY = 'deutsch-learn:completed-lektionen';

/**
 * ProgressService — تتبّع تقدم المستخدم محلياً (sentences + conversations).
 *
 * نمط Repository موحّد لكل أنواع التقدم.
 * كل نوع له:
 *   - signal خاص (private)
 *   - signal للقراءة فقط (public)
 *   - methods: mark, unmark, is, count
 *   - حفظ تلقائي في localStorage عبر effect
 */
@Injectable({ providedIn: 'root' })
export class ProgressService {

  // ═══════════════════════════════════════════
  // 📝 SENTENCES (number ids)
  // ═══════════════════════════════════════════

  private readonly _completedIds = signal<Set<number>>(
    this.loadFromStorage<number>(SENTENCES_KEY)
  );

  /** نسخة للقراءة (Set من معرّفات الجمل المنجزة) */
  readonly completedIds = this._completedIds.asReadonly();

  /** عدد الجمل المنجزة الإجمالي */
  readonly totalCompleted = computed(() => this._completedIds().size);

  /** هل الجملة منجزة؟ */
  isCompleted(sentenceId: number): boolean {
    return this._completedIds().has(sentenceId);
  }

  /** تأشير جملة كمنجزة */
  markCompleted(sentenceId: number): void {
    if (this._completedIds().has(sentenceId)) return;
    this._completedIds.update(s => new Set(s).add(sentenceId));
  }

  /** إزالة جملة من المنجزة */
  unmarkCompleted(sentenceId: number): void {
    if (!this._completedIds().has(sentenceId)) return;
    this._completedIds.update(s => {
      const next = new Set(s);
      next.delete(sentenceId);
      return next;
    });
  }

  /** كم جملة منجزة من قائمة معطاة (لإحصائيات مستوى مثلاً) */
  countCompletedAmong(sentenceIds: readonly number[]): number {
    const completed = this._completedIds();
    return sentenceIds.filter(id => completed.has(id)).length;
  }

  // ═══════════════════════════════════════════
  // 💬 CONVERSATIONS (string ids مثل 'doctor-headache')
  // ═══════════════════════════════════════════

  private readonly _completedConversationIds = signal<Set<string>>(
    this.loadFromStorage<string>(CONVERSATIONS_KEY)
  );

  /** نسخة للقراءة (Set من معرّفات المحادثات المنجزة) */
  readonly completedConversationIds = this._completedConversationIds.asReadonly();

  /** عدد المحادثات المنجزة */
  readonly totalCompletedConversations = computed(
    () => this._completedConversationIds().size
  );

  /** هل المحادثة منجزة؟ */
  isConversationCompleted(id: string): boolean {
    return this._completedConversationIds().has(id);
  }

  /** تأشير محادثة كمنجزة */
  markConversationCompleted(id: string): void {
    if (this._completedConversationIds().has(id)) return;
    this._completedConversationIds.update(s => new Set(s).add(id));
  }

  /** إزالة محادثة من المنجزة (لزر "Try again" مستقبلاً) */
  unmarkConversationCompleted(id: string): void {
    if (!this._completedConversationIds().has(id)) return;
    this._completedConversationIds.update(s => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
  }

  // ═══════════════════════════════════════════
  // 🎓 LEKTIONEN (string ids مثل 'b1-l1')
  // ═══════════════════════════════════════════

  private readonly _completedLektionIds = signal<Set<string>>(
    this.loadFromStorage<string>(LEKTIONEN_KEY)
  );

  /** نسخة للقراءة (Set من معرّفات الدروس المنجزة) */
  readonly completedLektionIds = this._completedLektionIds.asReadonly();

  /** هل الدرس منجز؟ */
  isLektionCompleted(id: string): boolean {
    return this._completedLektionIds().has(id);
  }

  /** تأشير درس كمنجز (يفتح الدرس التالي) */
  markLektionCompleted(id: string): void {
    if (this._completedLektionIds().has(id)) return;
    this._completedLektionIds.update(s => new Set(s).add(id));
  }

  /** إلغاء إنجاز درس (للمراجعة/إعادة الضبط) */
  unmarkLektionCompleted(id: string): void {
    if (!this._completedLektionIds().has(id)) return;
    this._completedLektionIds.update(s => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
  }

  /** كم درس منجز من قائمة معطاة (لشريط تقدّم الكورس) */
  countCompletedLektionenAmong(ids: readonly string[]): number {
    const completed = this._completedLektionIds();
    return ids.filter(id => completed.has(id)).length;
  }

  // ═══════════════════════════════════════════
  // 🧹 Reset (يمسح كل شيء)
  // ═══════════════════════════════════════════

  resetAll(): void {
    this._completedIds.set(new Set());
    this._completedConversationIds.set(new Set());
    this._completedLektionIds.set(new Set());
  }

  // ═══════════════════════════════════════════
  // 💾 الحفظ التلقائي (effects)
  // ═══════════════════════════════════════════

  constructor() {
    // كلما تغيّرت أي مجموعة، نحفظها تلقائياً في مفتاحها الخاص
    effect(() => this.saveToStorage(SENTENCES_KEY, this._completedIds()));
    effect(() => this.saveToStorage(CONVERSATIONS_KEY, this._completedConversationIds()));
  }

  // ═══════════════════════════════════════════
  // الـ helpers الخاصة (load/save)
  // ═══════════════════════════════════════════

  /**
   * 🎯 Generic loader — يعمل لـ number و string بنفس الشكل.
   *
   * <T extends number | string> = "T يجب أن يكون رقم أو نص".
   * هذا يجعل الـ method قابلة لإعادة الاستخدام لـ المجموعتين.
   *
   * مقابل في C#:
   *   private HashSet<T> LoadFromStorage<T>(string key) where T : ...
   */
  private loadFromStorage<T extends number | string>(key: string): Set<T> {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return new Set();
      const arr = JSON.parse(raw) as T[];
      return new Set(arr);
    } catch {
      return new Set();
    }
  }

  private saveToStorage<T>(key: string, set: Set<T>): void {
    try {
      localStorage.setItem(key, JSON.stringify([...set]));
    } catch (e) {
      console.warn(`Failed to save to localStorage (${key}):`, e);
    }
  }
}
