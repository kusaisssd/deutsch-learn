import { Component, computed, effect, inject, input, linkedSignal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CoursesService } from '../../../core/services/courses';
import { ProgressService } from '../../../core/services/progress';
import { SpeechService } from '../../../core/services/speech';
import { SpeechRecognitionService } from '../../../core/services/speech-recognition';
import { compareGerman, ComparisonResult } from '../../../shared/utils/similarity';
import { LektionStep } from '../../../core/models/course.model';

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
  readonly speechRec = inject(SpeechRecognitionService);

  constructor() {
    // 🎤 عند وصول نص من التعرّف الصوتي في خطوة تحدّث، نقارنه بالجملة المتوقّعة
    effect(() => {
      const transcript = this.speechRec.lastTranscript();
      const step = this.currentStep();
      if (!transcript || step?.kind !== 'speak' || !step.text) return;
      this.speechResult.set(compareGerman(transcript, step.text));
    });
  }

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

  /** هل أُجيب على السؤال؟ (quiz/reading مفرد) */
  readonly answered = computed(() => this.selectedOption() !== null);

  /** هل الإجابة المختارة صحيحة؟ */
  readonly isCorrect = computed(() => {
    const step = this.currentStep();
    return step != null && this.selectedOption() === step.correct;
  });

  // ───────── 🆕 حالة القراءة متعددة الأسئلة ─────────

  /**
   * إجابات أسئلة القراءة المتعددة: مصفوفة index لكل سؤال (null = لم يُجب).
   * تُعاد التهيئة عند تغيّر الخطوة.
   */
  readonly readingAnswers = linkedSignal<LektionStep | null, (number | null)[]>({
    source: this.currentStep,
    computation: (step) =>
      step?.kind === 'reading' && step.questions ? step.questions.map(() => null) : [],
  });

  /** اختيار خيار لسؤال قراءة معيّن (يُقفل بعد الاختيار) */
  selectReadingOption(qi: number, oi: number) {
    const arr = this.readingAnswers();
    if (arr[qi] != null) return; // مُقفل
    const copy = [...arr];
    copy[qi] = oi;
    this.readingAnswers.set(copy);
  }

  /** هل أُجيب على كل أسئلة القراءة المتعددة؟ */
  readonly readingAllAnswered = computed(() => {
    const step = this.currentStep();
    if (step?.kind !== 'reading' || !step.questions) return true;
    return this.readingAnswers().every(a => a != null);
  });

  // ───────── 🆕 حالة التحدّث (speak) ─────────

  /** نتيجة مقارنة النطق (null = لم يُحاول بعد) — تُعاد عند تغيّر الخطوة */
  readonly speechResult = linkedSignal<LektionStep | null, ComparisonResult | null>({
    source: this.currentStep,
    computation: () => null,
  });

  startListening() {
    this.speechResult.set(null);
    this.speechRec.clearResult();
    this.speechRec.start('de-DE');
  }
  stopListening() {
    this.speechRec.stop();
  }

  /** نسبة مئوية مدوّرة (للعرض في نتيجة النطق) */
  pct(n: number): number {
    return Math.round(n * 100);
  }

  /**
   * هل يمكن الانتقال للخطوة التالية الآن؟
   *   quiz        → بعد الإجابة
   *   reading      → بعد الإجابة (مفرد) أو كل الأسئلة (متعدد)
   *   discovery    → بعد الكشف
   *   speak/البقية → دائماً (التحدّث غير مُلزِم — الميكروفون قد لا يعمل)
   */
  readonly canAdvance = computed(() => {
    const step = this.currentStep();
    if (!step) return false;
    if (step.kind === 'quiz') return this.answered();
    if (step.kind === 'reading') {
      return step.questions ? this.readingAllAnswered() : this.answered();
    }
    if (step.kind === 'discovery') return this.revealed();
    return true;
  });

  // ───────── أفعال التفاعل ─────────

  /** اختيار خيار في quiz/reading مفرد (يُقفل بعد الاختيار) */
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
