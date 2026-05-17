import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LevelsService } from '../../../core/services/levels';
import { SentencesService } from '../../../core/services/sentences';
import { ProgressService } from '../../../core/services/progress';
import { LevelCode } from '../../../core/models/level.model';

/**
 * صفحة اختيار المستوى.
 *
 * تشبه Controller + View في ASP.NET:
 *   - تحقن LevelsService (مثل Constructor Injection)
 *   - تعرض البيانات في الـ template
 *   - كل بطاقة فيها [routerLink] للانتقال إلى صفحة الجمل
 */
@Component({
  selector: 'app-levels-page',
  // نستورد RouterLink كي نستطيع استخدام [routerLink] في الـ HTML
  imports: [RouterLink],
  templateUrl: './levels-page.html',
  styleUrl: './levels-page.scss',
})
export class LevelsPage {
  /**
   * inject() = الطريقة الحديثة للحصول على service.
   * البديل القديم: constructor(private levelsService: LevelsService) { }
   * كلاهما يعمل، لكن inject() أكثر مرونة و أنظف.
   *
   * هذا مساوٍ لـ ASP.NET:
   *   public LevelsController(ILevelsService service) { _service = service; }
   */
  private levelsService = inject(LevelsService);
  private sentencesService = inject(SentencesService);
  private progressService = inject(ProgressService);

  readonly levels = this.levelsService.levels;

  /**
   * computed يُرجع إحصائيات كل مستوى:
   *   { A1: { done: 3, total: 5 }, A2: { done: 0, total: 3 }, ... }
   *
   * يُعاد حسابه تلقائياً عند:
   *   - تحميل الجمل من JSON (sentences signal)
   *   - تغيّر التقدم (completedIds signal)
   */
  readonly statsByLevel = computed(() => {
    const allSentences = this.sentencesService.sentences();
    const stats: Record<LevelCode, { done: number; total: number }> = {
      A1: { done: 0, total: 0 },
      A2: { done: 0, total: 0 },
      B1: { done: 0, total: 0 },
      B2: { done: 0, total: 0 },
    };
    for (const s of allSentences) {
      stats[s.level].total++;
      if (this.progressService.isCompleted(s.id)) {
        stats[s.level].done++;
      }
    }
    return stats;
  });
}
