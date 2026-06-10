import { Component, computed, inject } from '@angular/core';
import { CelebrationService } from '../../../core/services/celebration';

/**
 * عرض احتفاء عربي مع ألعاب نارية CSS.
 * مُلتصق في جذر التطبيق؛ يَظهر فقط عندما CelebrationService.active()
 * يحوي قيمة، ثم يختفي بعد مدّة قصيرة.
 */
@Component({
  selector: 'app-celebration',
  imports: [],
  templateUrl: './celebration.html',
  styleUrl: './celebration.scss',
})
export class Celebration {
  private svc = inject(CelebrationService);
  readonly active = this.svc.active;

  /** 16 جسيماً للاحتفاء الصغير، 28 للكبير */
  readonly particles = computed(() => {
    const a = this.active();
    if (!a) return [] as number[];
    const n = a.type === 'big' ? 28 : 16;
    return Array.from({ length: n }, (_, i) => i);
  });

  /** زاوية كل جسيم (بالدرجات) لتوزيعها بانتظام حول المركز */
  angle(i: number): number {
    const total = this.particles().length;
    return (360 / total) * i;
  }

  /** ألوان زاهية متناوبة للجسيمات */
  color(i: number): string {
    const colors = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6'];
    return colors[i % colors.length];
  }

  dismiss(): void {
    this.svc.dismiss();
  }
}
