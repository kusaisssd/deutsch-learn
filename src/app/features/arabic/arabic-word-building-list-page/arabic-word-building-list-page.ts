import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArabicWordBuildingService } from '../../../core/services/arabic-word-building';

/**
 * شبكة كلمات Wortbildung. تُجمَّع حسب الصعوبة (سهل/وسط/صعب).
 * النقر على بطاقة كلمة يفتح صفحة البناء التفاعلية.
 */
@Component({
  selector: 'app-arabic-word-building-list-page',
  imports: [RouterLink],
  templateUrl: './arabic-word-building-list-page.html',
})
export class ArabicWordBuildingListPage {
  private svc = inject(ArabicWordBuildingService);

  readonly loaded = this.svc.loaded;
  readonly byDifficulty = this.svc.byDifficulty;

  readonly levels = [
    { num: 1, label: 'Einfach (2–3 Buchstaben)', emoji: '🟢' },
    { num: 2, label: 'Mittel (4–5 Buchstaben)', emoji: '🟡' },
    { num: 3, label: 'Schwer (5+ Buchstaben)', emoji: '🔴' },
  ];
}
