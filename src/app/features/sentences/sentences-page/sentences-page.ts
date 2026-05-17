import { Component, inject, input, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SentencesService } from '../../../core/services/sentences';
import { ProgressService } from '../../../core/services/progress';
import { LevelCode } from '../../../core/models/level.model';

/**
 * صفحة عرض جمل مستوى معين.
 *
 * مثال URL: /levels/A1/sentences
 *           → level = 'A1'
 *
 * كيف نقرأ :level من الـ URL؟
 *   بفضل withComponentInputBinding() في app.config،
 *   نكتب فقط: level = input.required<LevelCode>()
 *   و Angular يضع قيمة :level من الـ URL تلقائياً!
 *
 * يقابل في ASP.NET:
 *   public IActionResult Sentences(string level) { ... }
 */
@Component({
  selector: 'app-sentences-page',
  imports: [RouterLink],
  templateUrl: './sentences-page.html',
  styleUrl: './sentences-page.scss',
})
export class SentencesPage {
  /**
   * input.required = "هذا المدخل مطلوب، يجب أن يكون له قيمة".
   * اسم 'level' يطابق اسم المتغير في الـ route: path: 'levels/:level/sentences'
   *
   * هذا signal! نقرؤه بـ this.level() (مع الأقواس).
   */
  readonly level = input.required<LevelCode>();

  /** نحقن الـ services */
  private sentencesService = inject(SentencesService);
  private progressService = inject(ProgressService);

  /**
   * نعرّض completedIds للـ template كي يقرأ "هل هذه الجملة منجزة؟".
   * (لا نستطيع استدعاء method في template، لذا نعرّض الـ signal مباشرة.)
   */
  readonly completedIds = this.progressService.completedIds;

  /** عدد الجمل المنجزة من هذا المستوى (للعرض في رأس الصفحة) */
  readonly completedCount = computed(() => {
    const ids = this.sentences().map(s => s.id);
    return this.progressService.countCompletedAmong(ids);
  });

  /** هل تم تحميل البيانات؟ (لإظهار loading) */
  readonly loaded = this.sentencesService.loaded;

  /**
   * الجمل المعروضة لهذه الصفحة.
   *
   * هذا computed signal: يُحسب من القيم الحية للـ signals الأخرى:
   *   - level() من URL
   *   - sentences() من الـ service
   *
   * كلما تغيّر أحدهما، يُعاد الحساب تلقائياً (هذا قوة Angular الحديثة).
   *
   * مقابل في C#:
   *   public IEnumerable<Sentence> Sentences => _service.GetByLevel(Level);
   */
  readonly sentences = computed(() => {
    const currentLevel = this.level();
    return this.sentencesService.sentences().filter(s => s.level === currentLevel);
  });
}
