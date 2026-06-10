import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { ArabicService } from './arabic';
import { ArabicWord } from '../models/arabic.model';

const DAILY_KEY = 'deutsch-learn:arabic-daily';

interface DailyState {
  /** آخر يوم فُتح فيه التحدّي (YYYY-MM-DD) */
  lastDay: string;
  /** عدد الأيام المتتالية */
  streak: number;
  /** أعلى سلسلة سُجِّلت */
  bestStreak: number;
  /** هل أُكمل تحدّي اليوم؟ */
  doneToday: boolean;
}

const INIT_STATE: DailyState = { lastDay: '', streak: 0, bestStreak: 0, doneToday: false };

/**
 * ArabicDailyService — تحدّي يومي يختار كلمة عشوائية ثابتة لكل يوم،
 * و يتتبّع سلسلة الأيام المتتالية (streak).
 */
@Injectable({ providedIn: 'root' })
export class ArabicDailyService {
  private words = inject(ArabicService);

  private readonly _state = signal<DailyState>(this.loadState());
  readonly state = this._state.asReadonly();

  /** التاريخ بصيغة YYYY-MM-DD */
  private todayKey(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** يولّد رقماً ثابتاً (seed) من تاريخ اليوم */
  private dailySeed(): number {
    const k = this.todayKey();
    let h = 0;
    for (let i = 0; i < k.length; i++) h = ((h << 5) - h + k.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  /** كلمة اليوم: ثابتة لكل يوم، تتغيّر بعد منتصف الليل */
  readonly wordOfDay = computed<ArabicWord | null>(() => {
    const cats = this.words.categories();
    if (!cats.length) return null;
    // اجمع كل الكلمات في قائمة واحدة
    const all: ArabicWord[] = [];
    for (const c of cats) all.push(...c.words);
    if (!all.length) return null;
    const idx = this.dailySeed() % all.length;
    return all[idx];
  });

  /** هل التطبيق جاهز (المفردات مُحمَّلة)؟ */
  readonly ready = computed(() => this.words.loaded() && this.wordOfDay() !== null);

  /** يُحدّث السلسلة عند فتح التحدّي اليوم */
  init(): void {
    const s = this._state();
    const today = this.todayKey();
    if (s.lastDay === today) return; // أُحضِر اليوم

    // إن كان آخر فتح أمس، نزيد السلسلة؛ غير ذلك نُعيدها لـ1
    const isYesterday = this.isYesterday(s.lastDay, today);
    const newStreak = isYesterday ? s.streak + 1 : 1;
    const best = Math.max(s.bestStreak, newStreak);

    this._state.set({ lastDay: today, streak: newStreak, bestStreak: best, doneToday: false });
  }

  /** عند الضغط على «تمّ»: يأشّر التحدّي كمنجَز اليوم */
  markDone(): void {
    this._state.update(s => ({ ...s, doneToday: true }));
  }

  private isYesterday(prev: string, today: string): boolean {
    if (!prev) return false;
    const p = new Date(prev);
    const t = new Date(today);
    const diff = (t.getTime() - p.getTime()) / (1000 * 60 * 60 * 24);
    return Math.round(diff) === 1;
  }

  constructor() {
    effect(() => this.saveState(this._state()));
  }

  private loadState(): DailyState {
    try {
      const raw = localStorage.getItem(DAILY_KEY);
      return raw ? { ...INIT_STATE, ...JSON.parse(raw) } : INIT_STATE;
    } catch { return INIT_STATE; }
  }
  private saveState(s: DailyState): void {
    try { localStorage.setItem(DAILY_KEY, JSON.stringify(s)); }
    catch (e) { console.warn('Failed to save daily state:', e); }
  }
}
