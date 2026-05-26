import { Component, computed, effect, inject, input, linkedSignal, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { WritingService } from '../../../core/services/writing';
import { SpeechService } from '../../../core/services/speech';

/**
 * صفحة تمرين كتابة واحد.
 *
 * التدفّق المقصود تعليمياً:
 *   1) اقرأ المهمّة (Aufgabe) و النقاط المطلوبة.
 *   2) استعن بالبنية و العبارات المفيدة.
 *   3) اكتب نصّك في الصندوق (يُحفظ تلقائياً، مع عدّاد كلمات).
 *   4) راجع نفسك بقائمة التحقّق.
 *   5) اكشف النموذج و قارن، ثم أشّر «أنجزت».
 */
@Component({
  selector: 'app-writing-task-page',
  imports: [RouterLink],
  templateUrl: './writing-task-page.html',
})
export class WritingTaskPage {
  readonly taskId = input.required<string>();

  private writing = inject(WritingService);
  private router = inject(Router);
  readonly speech = inject(SpeechService);

  readonly loaded = this.writing.loaded;
  readonly task = computed(() => this.writing.taskById(this.taskId())());

  /** نصّ المستخدم — يُهيّأ من المسوّدة المحفوظة، و يُعاد عند تغيّر التمرين */
  readonly text = linkedSignal({
    source: this.task,
    computation: (task) => (task ? this.writing.drafts()[task.id] ?? '' : ''),
  });

  /** هل كُشف النموذج؟ (يُعاد عند تغيّر التمرين) */
  readonly showModel = linkedSignal({
    source: this.task,
    computation: () => false,
  });

  /** بنود قائمة التحقّق المُعلَّمة (Set من الفهارس) — تُعاد عند تغيّر التمرين */
  readonly checked = linkedSignal<unknown, Set<number>>({
    source: this.task,
    computation: () => new Set<number>(),
  });

  constructor() {
    // حفظ المسوّدة تلقائياً كلما تغيّر النص
    effect(() => {
      const t = this.task();
      if (t) this.writing.setDraft(t.id, this.text());
    });
  }

  /** عدد الكلمات في نصّ المستخدم */
  readonly wordCount = computed(() => {
    const t = this.text().trim();
    return t ? t.split(/\s+/).length : 0;
  });

  /** هل بلغ الحدّ الأدنى المُقترح؟ */
  readonly reachedMin = computed(() => {
    const t = this.task();
    return t ? this.wordCount() >= t.minWords : false;
  });

  readonly isDone = computed(() => {
    const t = this.task();
    return t ? this.writing.isDone(t.id) : false;
  });

  onInput(value: string) {
    this.text.set(value);
  }

  toggleCheck(i: number) {
    this.checked.update(s => {
      const next = new Set(s);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  isChecked(i: number): boolean {
    return this.checked().has(i);
  }

  reveal() {
    this.showModel.set(true);
  }

  toggleDone() {
    const t = this.task();
    if (!t) return;
    this.writing.isDone(t.id) ? this.writing.unmarkDone(t.id) : this.writing.markDone(t.id);
  }

  /** نطق نصّ النموذج بالألمانية */
  speak(text: string) {
    this.speech.speak(text);
  }

  back() {
    this.router.navigate(['/writing']);
  }
}
