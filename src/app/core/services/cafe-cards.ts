import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CafeCategory } from '../models/cafe-card.model';

/**
 * CafeCardsService
 *
 * يحمّل بيانات بطاقات الحوار الذاتي (Cards Café) من ملف JSON واحد.
 *
 * نفس نمط الـ services الأخرى التي تحمّل JSON:
 *   - signal خاص يحوي البيانات
 *   - signal للقراءة فقط للخارج
 *   - dataLoaded signal للحالة
 *   - computed/helper للبحث بـ id
 */
@Injectable({ providedIn: 'root' })
export class CafeCardsService {
  private http = inject(HttpClient);

  private readonly _categories = signal<CafeCategory[]>([]);
  private readonly _loaded = signal(false);

  readonly categories = this._categories.asReadonly();
  readonly loaded = this._loaded.asReadonly();

  /**
   * إرجاع فئة عبر id كـ computed (تفاعلي).
   * يُستخدم في صفحة سحب البطاقات لإيجاد الفئة الحالية.
   */
  categoryById(id: string) {
    return computed(() => this._categories().find(c => c.id === id));
  }

  constructor() {
    this.http.get<CafeCategory[]>('/data/cafe-cards.json').subscribe({
      next: (data) => {
        this._categories.set(data);
        this._loaded.set(true);
      },
      error: (err) => {
        console.error('Failed to load cafe cards:', err);
        this._loaded.set(true);
      },
    });
  }
}
