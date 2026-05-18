import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { CafeCardsService } from '../../../core/services/cafe-cards';

/**
 * صفحة قائمة فئات Cards Café.
 *
 * تعرض شبكة من 10 بطاقات ملوّنة مطابقة لتصميم لعبة Talk-Box الأصلية.
 * الضغط على بطاقة → /cafe/:categoryId (يُرسم كـ modal فوق هذه الشبكة).
 *
 * 🎯 router-outlet هنا يستقبل CafeDrawPage كـ child route.
 *    CafeDrawPage يضبط نفسه كـ position:fixed → يصبح lightbox modal
 *    فوق هذه الصفحة دون إخفائها.
 */
@Component({
  selector: 'app-cafe-list-page',
  imports: [RouterLink, RouterOutlet],
  templateUrl: './cafe-list-page.html',
  styleUrl: './cafe-list-page.scss',
})
export class CafeListPage {
  private cafeService = inject(CafeCardsService);

  readonly categories = this.cafeService.categories;
  readonly loaded = this.cafeService.loaded;
}
