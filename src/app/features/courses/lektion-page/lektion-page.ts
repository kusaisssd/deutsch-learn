import { Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CoursesService } from '../../../core/services/courses';
import { ProgressService } from '../../../core/services/progress';
import { SpeechService } from '../../../core/services/speech';

/**
 * صفحة درس واحد (Lektion) — المحتوى التعليمي الكامل.
 *
 * يعرض بالترتيب: الأهداف → المفردات → القواعد → نص القراءة.
 * زر "Mark as complete" يفتح الدرس التالي (التقدّم المقفل).
 *
 * 🔒 حماية: لو حاول المستخدم الوصول لدرس مقفل عبر URL مباشرة،
 *    نعيد توجيهه لصفحة الكورس (السلامة + منطق التسلسل).
 */
@Component({
  selector: 'app-lektion-page',
  imports: [RouterLink],
  templateUrl: './lektion-page.html',
  styleUrl: './lektion-page.scss',
})
export class LektionPage {
  readonly courseId = input.required<string>();
  readonly lektionId = input.required<string>();

  private coursesService = inject(CoursesService);
  private progress = inject(ProgressService);
  private router = inject(Router);
  readonly speech = inject(SpeechService);

  readonly loaded = this.coursesService.loaded;

  /** بيانات الدرس + السياق (course, prev, next, index) */
  readonly lookup = computed(() =>
    this.coursesService.lektionLookup(this.courseId(), this.lektionId())()
  );

  readonly lektion = computed(() => this.lookup()?.lektion ?? null);

  /** هل هذا الدرس منجز؟ */
  readonly isDone = computed(() =>
    this.progress.completedLektionIds().has(this.lektionId())
  );

  /**
   * هل الدرس مفتوح؟ (الأول، أو السابق منجز)
   * نستخدمها للحماية من الوصول المباشر لدرس مقفل.
   */
  readonly isUnlocked = computed(() => {
    const lk = this.lookup();
    if (!lk) return false;
    if (lk.index === 0) return true;
    return lk.prev ? this.progress.isLektionCompleted(lk.prev.id) : true;
  });

  /** يؤشّر الدرس كمنجز (يفتح التالي) */
  markComplete() {
    const lk = this.lektion();
    if (lk) this.progress.markLektionCompleted(lk.id);
  }

  /** نطق نص ألماني (مفردة، مثال، أو سطر من القراءة) */
  speak(text: string) {
    this.speech.speak(text);
  }

  /** الانتقال للدرس التالي (بعد الإنجاز) */
  goToNext() {
    const lk = this.lookup();
    if (lk?.next) {
      this.router.navigate(['/courses', this.courseId(), 'lektion', lk.next.id]);
    } else {
      // آخر درس → نرجع لصفحة الكورس
      this.router.navigate(['/courses', this.courseId()]);
    }
  }
}
