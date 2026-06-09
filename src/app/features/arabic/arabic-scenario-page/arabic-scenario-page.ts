import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ArabicScenariosService } from '../../../core/services/arabic-scenarios';
import { SpeechService } from '../../../core/services/speech';
import { ArabicForm, BilingualSentence, BilingualVocab, LearnPath, Step } from '../../../core/models/arabic-scenarios.model';
import { shuffle } from '../../../shared/utils/shuffle';

/**
 * Szenario-Player — die zentrale Lernoberfläche.
 *
 * Steuert die Schritte (intro / vocab / listen / dialogue / respond /
 * fill / translate / recap) und bietet einen Vergleichs-Toggle, mit dem
 * man jederzeit die jeweils andere Sprachvariante einblenden kann.
 */
@Component({
  selector: 'app-arabic-scenario-page',
  imports: [RouterLink],
  templateUrl: './arabic-scenario-page.html',
})
export class ArabicScenarioPage {
  readonly path = input.required<string>();
  readonly id = input.required<string>();

  private svc = inject(ArabicScenariosService);
  private router = inject(Router);
  readonly speech = inject(SpeechService);

  readonly pathValue = computed<LearnPath>(() => (this.path() === 'syrian' ? 'syrian' : 'fusha'));
  readonly otherPath = computed<LearnPath>(() => (this.pathValue() === 'fusha' ? 'syrian' : 'fusha'));

  readonly loaded = this.svc.loaded;
  readonly scenario = computed(() => this.svc.scenarioById(this.id())());

  // ───────── المقارنة ─────────
  /** هل عرض المقارنة مفعّل؟ (يبدأ من تفضيل المستخدم) */
  readonly compareOn = signal(this.svc.compareDefault());
  toggleCompare() {
    const next = !this.compareOn();
    this.compareOn.set(next);
    this.svc.setCompareDefault(next);
  }

  // ───────── إدارة الخطوات ─────────
  readonly steps = computed<Step[]>(() => this.scenario()?.steps ?? []);
  readonly stepIndex = linkedSignal({ source: this.scenario, computation: () => 0 });
  readonly currentStep = computed<Step | null>(() => this.steps()[this.stepIndex()] ?? null);
  readonly totalSteps = computed(() => this.steps().length);
  readonly progressPercent = computed(() => {
    const t = this.totalSteps();
    return t > 0 ? ((this.stepIndex() + 1) / t) * 100 : 0;
  });
  readonly isLastStep = computed(() => this.stepIndex() >= this.totalSteps() - 1);

  // ───────── حالة الخطوة الحالية ─────────
  /** خيار مُحدَّد (respond/fill/translate) */
  readonly selectedOption = linkedSignal<Step | null, number | null>({
    source: this.currentStep, computation: () => null,
  });
  readonly answered = computed(() => this.selectedOption() !== null);
  readonly isCorrect = computed(() => {
    const step = this.currentStep();
    if (!step) return false;
    if (step.kind !== 'respond' && step.kind !== 'fill' && step.kind !== 'translate') return false;
    return this.selectedOption() === step.correct;
  });

  /** ترتيب مخلوط للخيارات */
  readonly optionsOrder = linkedSignal<Step | null, number[]>({
    source: this.currentStep,
    computation: (step) => {
      if (!step) return [];
      if (step.kind === 'respond' || step.kind === 'fill' || step.kind === 'translate') {
        return shuffle(step.options.map((_, i) => i));
      }
      return [];
    },
  });

  /** هل أظهر النصّ بعد الاستماع؟ */
  readonly listenRevealed = linkedSignal({ source: this.currentStep, computation: () => false });

  /** هل يمكن الانتقال؟ */
  readonly canAdvance = computed(() => {
    const step = this.currentStep();
    if (!step) return false;
    if (step.kind === 'respond' || step.kind === 'fill' || step.kind === 'translate') {
      return this.answered();
    }
    return true;
  });

  selectOption(i: number) {
    if (this.answered()) return;
    this.selectedOption.set(i);
  }

  revealListen() { this.listenRevealed.set(true); }

  advance() {
    if (!this.canAdvance()) return;
    if (this.isLastStep()) {
      const sc = this.scenario();
      if (sc) this.svc.markDone(this.pathValue(), sc.id);
      this.router.navigate(['/learn-arabic', this.pathValue()]);
    } else {
      this.stepIndex.update(i => i + 1);
    }
  }
  back() { this.stepIndex.update(i => Math.max(0, i - 1)); }

  // ───────── helpers للقالب ─────────

  /** الصيغة الأساسية لجملة ثنائية بحسب المسار */
  primary(s: BilingualSentence | BilingualVocab): ArabicForm {
    return this.pathValue() === 'fusha' ? s.fusha : s.syrian;
  }
  /** الصيغة الأخرى (للمقارنة) */
  other(s: BilingualSentence | BilingualVocab): ArabicForm {
    return this.pathValue() === 'fusha' ? s.syrian : s.fusha;
  }
  primaryLabel(): string {
    return this.pathValue() === 'fusha' ? 'Fusha' : 'Syrisch';
  }
  otherLabel(): string {
    return this.pathValue() === 'fusha' ? 'Syrisch' : 'Fusha';
  }

  /** نطق نصّ عربي */
  speakAr(text: string) {
    if (!text) return;
    this.speech.speak(text, 0.9, undefined, 'ar-SA');
  }

  /** type narrow helpers for template @switch */
  asIntro(s: Step) { return s.kind === 'intro' ? s : null; }
}
