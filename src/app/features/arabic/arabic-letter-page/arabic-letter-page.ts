import { Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ArabicAlphabetService } from '../../../core/services/arabic-alphabet';
import { SpeechService } from '../../../core/services/speech';

/**
 * تفاصيل حرف:
 *   - الحرف الكبير + الاسم + الموقع
 *   - النطق في الفصحى و السورية + تشبيه ألماني
 *   - 5-6 كلمات مثال — الفصحى و السورية تظهران معاً دائماً
 *   - تنقّل بين الحروف
 */
@Component({
  selector: 'app-arabic-letter-page',
  imports: [RouterLink],
  templateUrl: './arabic-letter-page.html',
})
export class ArabicLetterPage {
  readonly letterId = input.required<string>();

  private alphabet = inject(ArabicAlphabetService);
  private router = inject(Router);
  readonly speech = inject(SpeechService);

  readonly loaded = this.alphabet.loaded;
  readonly lookup = computed(() => this.alphabet.letterLookup(this.letterId())());
  readonly letter = computed(() => this.lookup()?.letter ?? null);

  speakAr(text: string) {
    if (!text) return;
    this.speech.speak(text, 0.85, undefined, 'ar-SA');
  }

  goToLetter(id: string) {
    this.router.navigate(['/learn-arabic/alphabet', id]);
  }
}
