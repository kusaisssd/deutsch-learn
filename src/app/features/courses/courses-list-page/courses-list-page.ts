import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CoursesService } from '../../../core/services/courses';
import { ProgressService } from '../../../core/services/progress';

/**
 * صفحة قائمة الكورسات المنهجية.
 *
 * تعرض الكورسات المتاحة (حالياً B1). كل بطاقة تُظهر:
 *   - العنوان و المستوى و الوصف
 *   - شريط تقدّم (كم درس أُنجز من الإجمالي)
 *   - رابط لصفحة تفاصيل الكورس
 */
@Component({
  selector: 'app-courses-list-page',
  imports: [RouterLink],
  templateUrl: './courses-list-page.html',
  styleUrl: './courses-list-page.scss',
})
export class CoursesListPage {
  private coursesService = inject(CoursesService);
  private progress = inject(ProgressService);

  readonly courses = this.coursesService.courses;
  readonly loaded = this.coursesService.loaded;

  /** إحصائيات كل كورس: { courseId: { done, total } } */
  readonly statsByCourse = computed(() => {
    const stats: Record<string, { done: number; total: number }> = {};
    for (const course of this.courses()) {
      const ids = course.lektionen.map(l => l.id);
      stats[course.id] = {
        total: ids.length,
        done: this.progress.countCompletedLektionenAmong(ids),
      };
    }
    return stats;
  });
}
