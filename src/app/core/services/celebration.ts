import { Injectable, signal } from '@angular/core';

interface Phrase {
  ar: string;
  translit: string;
}

/**
 * عبارات صغيرة (للجواب الصحيح): مزيج عام و شامي خفيف.
 */
const SMALL_PHRASES: Phrase[] = [
  { ar: 'برافو!',       translit: 'brāvō!' },
  { ar: 'تمام!',        translit: 'tamām!' },
  { ar: 'صحّ!',         translit: 'ṣaḥḥ!' },
  { ar: 'شاطر!',        translit: 'shāṭer!' },
  { ar: 'وَحْش!',        translit: 'waḥsh!' },
  { ar: 'تسلم إيدك!',  translit: 'tislam īdak!' },
  { ar: 'يعيشك!',       translit: 'yʿīshak!' },
  { ar: 'يا سلام!',     translit: 'yā salām!' },
  { ar: 'على راسي!',    translit: 'ʿala rāsī!' },
  { ar: 'يا قمر!',      translit: 'yā qamar!' },
];

/**
 * عبارات كبيرة (لإنجاز كامل): نكهة دمشقية «باب الحارة».
 */
const BIG_PHRASES: Phrase[] = [
  { ar: 'يا عيني عليك!',           translit: 'yā ʿēnī ʿalēk!' },
  { ar: 'قبضاي!',                   translit: 'qabaḍāy!' },
  { ar: 'يا أبو الزلم!',           translit: 'yā abu z-zlām!' },
  { ar: 'زلمة بميّة زلمة!',         translit: 'zalame bi-miyye zalame!' },
  { ar: 'شو هالعزّ!',              translit: 'shū hal-ʿizz!' },
  { ar: 'يا ابن الأصول!',          translit: 'yā ibn el-uṣūl!' },
  { ar: 'ما شاء الله عليك!',       translit: 'mā shāʾ allāh ʿalēk!' },
  { ar: 'برافووووو!',               translit: 'brāvōōō!' },
  { ar: 'تكرم عينك!',              translit: 'tikrim ʿēnak!' },
  { ar: 'يا حياتي عليك!',          translit: 'yā ḥayātī ʿalēk!' },
  { ar: 'يا روحي!',                 translit: 'yā rūḥī!' },
  { ar: 'يا عيوني!',                translit: 'yā ʿyūnī!' },
  { ar: 'تحفة!',                    translit: 'tuḥfe!' },
  { ar: 'عاش!',                     translit: 'ʿāsh!' },
  { ar: 'يعطيك العافية!',          translit: 'yaʿṭīk el-ʿāfye!' },
  { ar: 'أنت عبقري!',              translit: 'inta ʿabqari!' },
];

export type CelebrationType = 'small' | 'big';

export interface ActiveCelebration {
  ar: string;
  translit: string;
  type: CelebrationType;
  seed: number;
}

/**
 * CelebrationService — يطلق احتفاءً مرئياً مع عبارة عربية مشجّعة + نقل لاتيني.
 *
 *   - small: عند جواب صحيح. **يَظهر مرّةً بعد مرّة** (تناوب) لئلا يتكرّر كثيراً.
 *   - big:   عند إنجاز كامل (كلمة/درس) — يَظهر دائماً.
 */
@Injectable({ providedIn: 'root' })
export class CelebrationService {
  private readonly _active = signal<ActiveCelebration | null>(null);
  readonly active = this._active.asReadonly();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private seedCounter = 0;
  private smallCounter = 0;

  /** احتفاء صغير — يَظهر فقط في الاستدعاءات الفردية (1، 3، 5…) */
  small() {
    this.smallCounter++;
    if (this.smallCounter % 2 === 0) return;  // مرّة لا، مرّة نعم
    this.fire('small');
  }

  /** احتفاء كبير — دائماً */
  big() { this.fire('big'); }

  private fire(type: CelebrationType): void {
    const pool = type === 'big' ? BIG_PHRASES : SMALL_PHRASES;
    const p = pool[Math.floor(Math.random() * pool.length)];
    this.seedCounter++;
    this._active.set({ ar: p.ar, translit: p.translit, type, seed: this.seedCounter });

    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this._active.set(null),
      type === 'big' ? 3000 : 1800);
  }

  dismiss(): void {
    if (this.timer) clearTimeout(this.timer);
    this._active.set(null);
  }
}
