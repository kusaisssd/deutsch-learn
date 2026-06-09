import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArabicAlphabetService } from '../../../core/services/arabic-alphabet';
import { LearnPath } from '../../../core/models/arabic-scenarios.model';

/**
 * شبكة الأبجدية: 28 حرفاً منظّمة في شبكة. النقر على حرف يفتح تفاصيله.
 */
@Component({
  selector: 'app-arabic-alphabet-page',
  imports: [RouterLink],
  templateUrl: './arabic-alphabet-page.html',
})
export class ArabicAlphabetPage {
  readonly path = input.required<string>();
  private svc = inject(ArabicAlphabetService);

  readonly pathValue = computed<LearnPath>(() => (this.path() === 'syrian' ? 'syrian' : 'fusha'));
  readonly loaded = this.svc.loaded;
  readonly letters = this.svc.letters;

  /** نطق الحرف بحسب المسار */
  soundFor(letter: { fushaSound: string; syrianSound: string }): string {
    return this.pathValue() === 'fusha' ? letter.fushaSound : letter.syrianSound;
  }
}
