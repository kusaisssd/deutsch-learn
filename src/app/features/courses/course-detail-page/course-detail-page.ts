import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CoursesService } from '../../../core/services/courses';
import { ProgressService } from '../../../core/services/progress';

/**
 * صفحة تفاصيل كورس — قائمة الدروس بترتيبها مع التقدّم المقفل.
 *
 * 🔒 منطق القفل:
 *   الدرس مفتوح إذا: هو الأول، أو الدرس السابق منجز.
 *   هذا يفرض التسلسل المنهجي الذي طلبه المستخدم.
 *
 * 🧭 "Continue": أول درس غير منجز (و مفتوح) = الخطوة التالية.
 */
@Component({
  selector: 'app-course-detail-page',
  imports: [RouterLink],
  templateUrl: './course-detail-page.html',
  styleUrl: './course-detail-page.scss',
})
export class CourseDetailPage {
  readonly courseId = input.required<string>();

  private coursesService = inject(CoursesService);
  private progress = inject(ProgressService);

  readonly loaded = this.coursesService.loaded;
  readonly completedIds = this.progress.completedLektionIds;

  readonly course = computed(() => this.coursesService.courseById(this.courseId())());

  /**
   * يحوّل كل درس إلى view-model فيه حالته:
   *   - done: منجز؟
   *   - unlocked: مفتوح؟ (الأول دائماً، أو السابق منجز)
   *   - isNext: هل هو "الخطوة التالية" (أول غير منجز مفتوح)؟
   */
  readonly lektionStates = computed(() => {
    const course = this.course();
    if (!course) return [];
    const completed = this.completedIds();

    let nextAssigned = false;
    return course.lektionen.map((lektion, i) => {
      const done = completed.has(lektion.id);
      // مفتوح لو هو الأول أو الدرس السابق منجز
      const prevDone = i === 0 || completed.has(course.lektionen[i - 1].id);
      const unlocked = i === 0 || prevDone;

      // أول درس مفتوح و غير منجز = الخطوة التالية
      let isNext = false;
      if (!nextAssigned && unlocked && !done) {
        isNext = true;
        nextAssigned = true;
      }

      return { lektion, done, unlocked, isNext };
    });
  });

  /** عدد المنجز + الإجمالي (لشريط التقدّم) */
  readonly stats = computed(() => {
    const course = this.course();
    if (!course) return { done: 0, total: 0 };
    const ids = course.lektionen.map(l => l.id);
    return {
      total: ids.length,
      done: this.progress.countCompletedLektionenAmong(ids),
    };
  });

  /** الدرس التالي للمتابعة (أو null لو الكل منجز) */
  readonly nextLektion = computed(
    () => this.lektionStates().find(s => s.isNext)?.lektion ?? null
  );
}
