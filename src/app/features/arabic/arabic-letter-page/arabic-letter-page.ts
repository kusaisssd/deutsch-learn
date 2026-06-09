import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ArabicAlphabetService } from '../../../core/services/arabic-alphabet';
import { ArabicScenariosService } from '../../../core/services/arabic-scenarios';
import { SpeechService } from '../../../core/services/speech';
import { ArabicForm, BilingualVocab, LearnPath } from '../../../core/models/arabic-scenarios.model';

/**
 * تفاصيل حرف واحد:
 *   - الحرف الكبير + اسمه العربي + اسمه اللاتيني
 *   - نطقه في الفصحى و السورية
 *   - تشبيه ألماني
 *   - 5-6 كلمات مثال غنية في الصيغتَين، كلّ واحدة بصوت
 *   - تنقّل بين الحروف
 */
@Component({
  selector: 'app-arabic-letter-page',
  imports: [RouterLink],
  templateUrl: './arabic-letter-page.html',
})
export class ArabicLetterPage {
  readonly path = input.required<string>();
  readonly letterId = input.required<string>();

  private alphabet = inject(ArabicAlphabetService);
  private scenarios = inject(ArabicScenariosService);
  private router = inject(Router);
  readonly speech = inject(SpeechService);

  readonly pathValue = computed<LearnPath>(() => (this.path() === 'syrian' ? 'syrian' : 'fusha'));
  readonly loaded = this.alphabet.loaded;

  readonly lookup = computed(() => this.alphabet.letterLookup(this.letterId())());
  readonly letter = computed(() => this.lookup()?.letter ?? null);

  /** المقارنة (إظهار النطق و النصّ في المسار الآخر) */
  readonly compareOn = signal(this.scenarios.compareDefault());
  toggleCompare() {
    const next = !this.compareOn();
    this.compareOn.set(next);
    this.scenarios.setCompareDefault(next);
  }

  /** الصيغة الأساسية بحسب المسار */
  primary(item: BilingualVocab): ArabicForm {
    return this.pathValue() === 'fusha' ? item.fusha : item.syrian;
  }
  other(item: BilingualVocab): ArabicForm {
    return this.pathValue() === 'fusha' ? item.syrian : item.fusha;
  }
  primaryLabel(): string {
    return this.pathValue() === 'fusha' ? 'Fusha' : 'Syrisch';
  }
  otherLabel(): string {
    return this.pathValue() === 'fusha' ? 'Syrisch' : 'Fusha';
  }

  speakAr(text: string) {
    if (!text) return;
    this.speech.speak(text, 0.85, undefined, 'ar-SA');
  }

  goToLetter(id: string) {
    this.router.navigate(['/learn-arabic', this.pathValue(), 'alphabet', id]);
  }
}
