import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CoursesService } from '../../../core/services/courses';
import { ProgressService } from '../../../core/services/progress';
import { SpeechService } from '../../../core/services/speech';

/**
 * صفحة درس واحد (Lektion).
 *
 * نمطان:
 *   1) 🆕 تفاعلي — لو الدرس فيه `steps`: مُشغّل خطوة-بخطوة (Duolingo-style)
 *      مع feedback فوري و شريط تقدّم.
 *   2) كتابي — لو لا: العرض القديم (goals/vocab/grammar/reading).
 *
 * 🔒 حماية: درس مقفل عبر URL مباشر → شاشة "أكمل السابق".
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

  readonly lookup = computed(() =>
    this.coursesService.lektionLookup(this.courseId(), this.lektionId())()
  );
  readonly lektion = computed(() => this.lookup()?.lektion ?? null);

  readonly isDone = computed(() =>
    this.progress.completedLektionIds().has(this.lektionId())
  );

  /** هل الدرس مفتوح؟ (الأول، أو السابق منجز) — حماية من الوصول المباشر */
  readonly isUnlocked = computed(() => {
    const lk = this.lookup();
    if (!lk) return false;
    if (lk.index === 0) return true;
    return lk.prev ? this.progress.isLektionCompleted(lk.prev.id) : true;
  });

  // ═══════════════════════════════════════════
  // 🆕 الوضع التفاعلي (steps)
  // ═══════════════════════════════════════════

  readonly steps = computed(() => this.lektion()?.steps ?? []);
  readonly isInteractive = computed(() => this.steps().length > 0);

  /** index الخطوة الحالية — يُعاد لـ 0 عند تغيّر الدرس */
  readonly stepIndex = linkedSignal({
    source: this.lektion,
    computation: () => 0,
  });

  readonly currentStep = computed(() => this.steps()[this.stepIndex()] ?? null);
  readonly totalSteps = computed(() => this.steps().length);

  /** نسبة التقدّم (للـ progress bar) */
  readonly progressPercent = computed(() => {
    const total = this.totalSteps();
    return total > 0 ? ((this.stepIndex() + 1) / total) * 100 : 0;
  });

  readonly isLastStep = computed(() => this.stepIndex() >= this.totalSteps() - 1);

  // ───────── حالة تفاعل الخطوة (تُعاد عند تغيّر الخطوة) ─────────

  /** الخيار المُختار في quiz/reading (null = لم يُجب) */
  readonly selectedOption = linkedSignal<unknown, number | null>({
    source: this.currentStep,
    computation: () => null,
  });

  /** هل قَلَب الـ flashcard؟ */
  readonly flipped = linkedSignal({
    source: this.currentStep,
    computation: () => false,
  });

  /** هل كُشفت قاعدة الـ discovery؟ */
  readonly revealed = linkedSignal({
    source: this.currentStep,
    computation: () => false,
  });

  /** هل أُجيب على السؤال؟ (quiz/reading) */
  readonly answered = computed(() => this.selectedOption() !== null);

  /** هل الإجابة المختارة صحيحة؟ */
  readonly isCorrect = computed(() => {
    const step = this.currentStep();
    return step != null && this.selectedOption() === step.correct;
  });

  /**
   * هل يمكن الانتقال للخطوة التالية الآن؟
   *   quiz/reading → بعد الإجابة
   *   discovery    → بعد الكشف
   *   البقية       → دائماً
   */
  readonly canAdvance = computed(() => {
    const step = this.currentStep();
    if (!step) return false;
    if (step.kind === 'quiz' || step.kind === 'reading') return this.answered();
    if (step.kind === 'discovery') return this.revealed();
    return true;
  });

  // ───────── أفعال التفاعل ─────────

  /** اختيار خيار في quiz/reading (يُقفل بعد الاختيار) */
  selectOption(i: number) {
    if (this.answered()) return; // لا تغيير بعد الإجابة
    this.selectedOption.set(i);
  }

  /** قلب الـ flashcard */
  flip() {
    this.flipped.update(f => !f);
  }

  /** كشف قاعدة الـ discovery */
  reveal() {
    this.revealed.set(true);
  }

  /** الانتقال للخطوة التالية، أو إنهاء الدرس لو كانت الأخيرة */
  advance() {
    if (!this.canAdvance()) return;
    if (this.isLastStep()) {
      this.finishInteractive();
    } else {
      this.stepIndex.update(i => i + 1);
    }
  }

  /** الرجوع لخطوة سابقة (اختياري) */
  back() {
    this.stepIndex.update(i => Math.max(0, i - 1));
  }

  /** إنهاء الدرس التفاعلي: تأشير كمنجز ثم العودة لصفحة الكورس */
  private finishInteractive() {
    const lk = this.lektion();
    if (lk) this.progress.markLektionCompleted(lk.id);
    this.router.navigate(['/courses', this.courseId()]);
  }

  // ═══════════════════════════════════════════
  // الوضع الكتابي القديم (الدروس 2-5)
  // ═══════════════════════════════════════════

  markComplete() {
    const lk = this.lektion();
    if (lk) this.progress.markLektionCompleted(lk.id);
  }

  goToNext() {
    const lk = this.lookup();
    if (lk?.next) {
      this.router.navigate(['/courses', this.courseId(), 'lektion', lk.next.id]);
    } else {
      this.router.navigate(['/courses', this.courseId()]);
    }
  }

  /** نطق نص ألماني (مشترك بين الوضعين) */
  speak(text: string) {
    this.speech.speak(text);
  }
}
