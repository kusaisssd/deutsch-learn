import { Injectable, signal } from '@angular/core';

/** عبارات تشجيعية عربية (مزيج فصحى + شامي) */
const SMALL_PHRASES = [
  'برافو!',
  'ممتاز!',
  'أحسنت!',
  'يا سلام!',
  'شاطر!',
  'تمام!',
  'صحّ!',
  'جامد!',
  'يا قمر!',
  'يلّا!',
];

const BIG_PHRASES = [
  'ما شاء الله عليك!',
  'برافووووو!',
  'أنت عبقري!',
  'شيء رائع!',
  'يعطيك العافية!',
  'مبدع!',
  'أبدعت!',
  'يا أحلى!',
  'يا روحي!',
  'يا عيوني!',
  'تحفة!',
  'عاش!',
];

export type CelebrationType = 'small' | 'big';

export interface ActiveCelebration {
  phrase: string;
  type: CelebrationType;
  /** بذرة عشوائية: تتغيّر مع كل احتفاء → تُعيد تشغيل CSS animations */
  seed: number;
}

/**
 * CelebrationService — يطلق احتفاءً مرئياً مع عبارة عربية مشجّعة.
 *   - small: عند جواب صحيح (يختفي بعد ~1.8s).
 *   - big:   عند إنهاء درس/كلمة كاملة (يختفي بعد ~3s، أكثر زخماً).
 */
@Injectable({ providedIn: 'root' })
export class CelebrationService {
  private readonly _active = signal<ActiveCelebration | null>(null);
  readonly active = this._active.asReadonly();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private seedCounter = 0;

  small() { this.fire('small'); }
  big() { this.fire('big'); }

  private fire(type: CelebrationType): void {
    const pool = type === 'big' ? BIG_PHRASES : SMALL_PHRASES;
    const phrase = pool[Math.floor(Math.random() * pool.length)];
    this.seedCounter++;
    this._active.set({ phrase, type, seed: this.seedCounter });

    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this._active.set(null),
      type === 'big' ? 3000 : 1800);
  }

  dismiss(): void {
    if (this.timer) clearTimeout(this.timer);
    this._active.set(null);
  }
}
