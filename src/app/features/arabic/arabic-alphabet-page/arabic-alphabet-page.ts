import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArabicAlphabetService } from '../../../core/services/arabic-alphabet';

/** شبكة الأبجدية: 28 حرفاً. النقر يفتح تفاصيل الحرف. */
@Component({
  selector: 'app-arabic-alphabet-page',
  imports: [RouterLink],
  templateUrl: './arabic-alphabet-page.html',
})
export class ArabicAlphabetPage {
  private svc = inject(ArabicAlphabetService);
  readonly loaded = this.svc.loaded;
  readonly letters = this.svc.letters;
}
