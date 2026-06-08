import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ArabicCourseService } from '../../../core/services/arabic-course';
import { SpeechService } from '../../../core/services/speech';
import { ArabicStep, BuilderStep } from '../../../core/models/arabic-course.model';
import { shuffle } from '../../../shared/utils/shuffle';

/**
 * مشغّل دروس Arabisch lernen.
 *
 * يعرض خطوات الدرس بالترتيب (intro, letter, quiz, builder, …) و يحفظ التقدّم.
 * الواجهة بالألمانية في الأساس مع محتوى عربي بالاتجاه الصحيح (RTL) في
 * عناصره. مرآة لمشغّل lektion-page الألماني مع نوعَين جديدَين: letter و builder.
 */
@Component({
  selector: 'app-arabic-lektion-page',
  imports: [RouterLink],
  templateUrl: './arabic-lektion-page.html',
  styleUrl: './arabic-lektion-page.scss',
})
export class ArabicLektionPage {
  readonly lektionId = input.required<string>();

  private svc = inject(ArabicCourseService);
  private router = inject(Router);
  readonly speech = inject(SpeechService);

  readonly loaded = this.svc.loaded;

  readonly lookup = computed(() => this.svc.lektionLookup(this.lektionId())());
  readonly lektion = computed(() => this.lookup()?.lektion ?? null);

  readonly steps = computed(() => this.lektion()?.steps ?? []);
  readonly isUnlocked = computed(() => {
    const lk = this.lookup();
    if (!lk) return false;
    if (lk.index === 0) return true;
    return lk.prev ? this.svc.isDone(lk.prev.id) : true;
  });

  // ───────── current step state ─────────
  readonly stepIndex = linkedSignal({ source: this.lektion, computation: () => 0 });
  readonly currentStep = computed<ArabicStep | null>(() => this.steps()[this.stepIndex()] ?? null);
  readonly totalSteps = computed(() => this.steps().length);
  readonly progressPercent = computed(() => {
    const t = this.totalSteps();
    return t > 0 ? ((this.stepIndex() + 1) / t) * 100 : 0;
  });
  readonly isLastStep = computed(() => this.stepIndex() >= this.totalSteps() - 1);

  // ───────── per-step state ─────────
  /** خيار الـ quiz المُحدَّد */
  readonly selectedOption = linkedSignal<ArabicStep | null, number | null>({
    source: this.currentStep, computation: () => null,
  });
  readonly answered = computed(() => this.selectedOption() !== null);
  readonly isCorrect = computed(() => {
    const step = this.currentStep();
    if (step?.kind !== 'quiz') return false;
    return this.selectedOption() === step.correct;
  });

  /** ترتيب مخلوط لخيارات الـ quiz */
  readonly quizOrder = linkedSignal<ArabicStep | null, number[]>({
    source: this.currentStep,
    computation: (step) => step?.kind === 'quiz' ? shuffle(step.options.map((_, i) => i)) : [],
  });

  /** هل كُشفت قاعدة الـ discovery؟ */
  readonly revealed = linkedSignal({ source: this.currentStep, computation: () => false });

  /** هل قُلب الـ flashcard؟ */
  readonly flipped = linkedSignal({ source: this.currentStep, computation: () => false });

  // ───────── builder step state ─────────
  /** الكلمات المختارة بالترتيب (فهارس أصلية في step.words) */
  readonly builderPicked = linkedSignal<ArabicStep | null, number[]>({
    source: this.currentStep, computation: () => [],
  });
  /** الترتيب العرضي للكلمات المتاحة (مخلوط) */
  readonly builderOrder = linkedSignal<ArabicStep | null, number[]>({
    source: this.currentStep,
    computation: (step) => step?.kind === 'builder' ? shuffle(step.words.map((_, i) => i)) : [],
  });
  /** هل تمّ التحقّق؟ */
  readonly builderChecked = linkedSignal({ source: this.currentStep, computation: () => false });

  readonly builderAvailable = computed(() => {
    const order = this.builderOrder();
    const picked = new Set(this.builderPicked());
    return order.filter(i => !picked.has(i));
  });
  readonly builderComplete = computed(() => {
    const step = this.currentStep();
    if (step?.kind !== 'builder') return false;
    return this.builderPicked().length === step.words.length;
  });
  readonly builderCorrect = computed(() => {
    const step = this.currentStep();
    if (step?.kind !== 'builder') return false;
    const picked = this.builderPicked();
    if (picked.length !== step.words.length) return false;
    return picked.every((v, i) => v === i);
  });

  pickBuilderWord(originalIdx: number) {
    if (this.builderChecked()) return;
    this.builderPicked.update(p => [...p, originalIdx]);
  }
  unpickBuilderWord(positionInPicked: number) {
    if (this.builderChecked()) return;
    this.builderPicked.update(p => p.filter((_, i) => i !== positionInPicked));
  }
  checkBuilder() {
    if (!this.builderComplete()) return;
    this.builderChecked.set(true);
  }
  resetBuilder() {
    this.builderPicked.set([]);
    this.builderChecked.set(false);
  }

  // ───────── advance logic ─────────
  readonly canAdvance = computed(() => {
    const step = this.currentStep();
    if (!step) return false;
    if (step.kind === 'quiz') return this.answered();
    if (step.kind === 'discovery') return this.revealed();
    if (step.kind === 'builder') return this.builderChecked() && this.builderCorrect();
    return true;
  });

  // actions
  selectOption(i: number) {
    if (this.answered()) return;
    this.selectedOption.set(i);
  }
  reveal() { this.revealed.set(true); }
  flip() { this.flipped.update(f => !f); }
  advance() {
    if (!this.canAdvance()) return;
    if (this.isLastStep()) {
      const lk = this.lektion();
      if (lk) this.svc.markDone(lk.id);
      this.router.navigate(['/learn-arabic']);
    } else {
      this.stepIndex.update(i => i + 1);
    }
  }
  back() { this.stepIndex.update(i => Math.max(0, i - 1)); }

  /** نطق النصّ العربي عبر صوت ar-SA */
  speakAr(text: string) {
    if (!text) return;
    this.speech.speak(text, 0.9, undefined, 'ar-SA');
  }

  /** type narrow helper للقالب */
  asBuilder(step: ArabicStep): BuilderStep | null {
    return step.kind === 'builder' ? step : null;
  }
}
