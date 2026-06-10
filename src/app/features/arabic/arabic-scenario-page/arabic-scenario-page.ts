import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ArabicScenariosService } from '../../../core/services/arabic-scenarios';
import { SpeechService } from '../../../core/services/speech';
import { Step } from '../../../core/models/arabic-scenarios.model';
import { shuffle } from '../../../shared/utils/shuffle';

/**
 * Szenario-Player — vereinheitlichte Ansicht.
 *
 * Fusha und Syrisch werden in jedem Schritt nebeneinander angezeigt.
 * Kein Vergleichs-Toggle, kein Pfad-Parameter.
 */
@Component({
  selector: 'app-arabic-scenario-page',
  imports: [RouterLink],
  templateUrl: './arabic-scenario-page.html',
})
export class ArabicScenarioPage {
  readonly id = input.required<string>();

  private svc = inject(ArabicScenariosService);
  private router = inject(Router);
  readonly speech = inject(SpeechService);

  readonly loaded = this.svc.loaded;
  readonly scenario = computed(() => this.svc.scenarioById(this.id())());

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

  readonly listenRevealed = linkedSignal({ source: this.currentStep, computation: () => false });

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
      if (sc) this.svc.markDone(sc.id);
      this.router.navigate(['/learn-arabic']);
    } else {
      this.stepIndex.update(i => i + 1);
    }
  }
  back() { this.stepIndex.update(i => Math.max(0, i - 1)); }

  speakAr(text: string) {
    if (!text) return;
    this.speech.speak(text, 0.9, undefined, 'ar-SA');
  }
}
