import { Component, computed, input, output } from '@angular/core';

/**
 * أنماط بلاط الكلمة المختلفة.
 * - 'available' : كلمة في منطقة "المتاحة" (أبيض، إطار رمادي)
 * - 'selected'  : كلمة في منطقة "ترتيبك" (بنفسجي ممتلئ)
 */
export type WordTileVariant = 'available' | 'selected';

/**
 * WordTile = بلاط (زر) كلمة قابل لإعادة الاستخدام.
 *
 * 🎯 المفاهيم المهمة هنا:
 *
 * 1) input()  = الأب يمرّر بيانات للابن
 *      <app-word-tile [word]="'Ich'" [variant]="'available'" />
 *
 * 2) output() = الابن يخبر الأب بحدث
 *      <app-word-tile (clicked)="doSomething()" />
 *
 * 3) computed() = حساب CSS classes تلقائياً من الـ inputs
 *
 * مقابل في Blazor:
 *   [Parameter] string Word         ← input()
 *   [Parameter] EventCallback OnClick ← output()
 */
@Component({
  selector: 'app-word-tile',
  imports: [],
  templateUrl: './word-tile.html',
  styleUrl: './word-tile.scss',
})
export class WordTile {
  // ───────── Inputs (من الأب) ─────────

  /** الكلمة المعروضة. required = إجباري. */
  readonly word = input.required<string>();

  /** نمط البلاطة (يحدّد الألوان). */
  readonly variant = input<WordTileVariant>('available');

  /** هل البلاط معطّل (لا يقبل ضغط)؟ افتراضياً false. */
  readonly disabled = input<boolean>(false);

  // ───────── Outputs (للأب) ─────────

  /**
   * حدث الضغط. ليس له payload (مجرد إشارة).
   * الأب يستخدمه: <app-word-tile (clicked)="pickWord(tile)" />
   *
   * لاحظ: لا نسميه 'click' (تعارض مع DOM event)، بل 'clicked'.
   */
  readonly clicked = output<void>();

  // ───────── Logic ─────────

  /**
   * نحسب class CSS كاملة من الـ inputs.
   * computed() = يُعاد حسابه تلقائياً لو تغيّر variant() أو disabled().
   */
  readonly cssClasses = computed(() => {
    const base = 'px-4 py-2 rounded-md font-medium transition-colors';

    if (this.disabled()) {
      return `${base} opacity-70 cursor-not-allowed bg-indigo-600 text-white`;
    }

    if (this.variant() === 'selected') {
      return `${base} bg-indigo-600 text-white shadow-sm hover:bg-indigo-700`;
    }

    // available
    return `${base} bg-white border-2 border-slate-300 text-slate-800 hover:border-indigo-500 hover:bg-indigo-50`;
  });

  /** يُستدعى عند الضغط — يطلق الحدث للأب */
  onClick() {
    if (this.disabled()) return;
    this.clicked.emit();
  }
}
