import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DictionaryService } from '../../../core/services/dictionary';
import { ClaudeLookupService } from '../../../core/services/claude-lookup';
import { SyncService } from '../../../core/services/sync';
import { SpeechService } from '../../../core/services/speech';
import { DictHistoryEntry } from '../../../core/models/dictionary.model';
import { ClaudeDeepResult, ClaudeLookupResult, DictAsk } from '../../../core/models/claude-lookup.model';
import { shuffle } from '../../../shared/utils/shuffle';

interface DayGroup {
  key: string;
  label: string;
  isToday: boolean;
  entries: DictHistoryEntry[];
}

type ViewMode = 'cards' | 'list';

/**
 * صفحة «مراجعة القاموس» — بنمطَي عرض:
 *   - 🃏 كاردات: كاروسيل بطاقة قلب واحدة — الجهة الأمامية الكلمة،
 *     الخلفية الترجمة + شرح AI + أزرار جلب AI و اطلب المزيد.
 *   - 📋 قائمة: مقسّمة حسب اليوم مع طيّ/فتح.
 */
@Component({
  selector: 'app-dictionary-review-page',
  imports: [RouterLink, DatePipe],
  templateUrl: './dictionary-review-page.html',
  styleUrl: './dictionary-review-page.scss',
})
export class DictionaryReviewPage {
  private dict = inject(DictionaryService);
  readonly claude = inject(ClaudeLookupService);
  readonly sync = inject(SyncService);
  readonly speech = inject(SpeechService);

  readonly history = this.dict.history;
  readonly mode = signal<ViewMode>('cards');
  readonly syncing = signal(false);

  constructor() {
    // كل مرّة يفتح المستخدم صفحة المراجعة → اسحب أحدث نسخة من السحابة
    // (فيديو الاستخدام: بحث بالنهار من الديسكتوب، مراجعة بالمساء من الموبايل)
    if (this.sync.hasPassphrase()) {
      this.dict.doInitialPull().catch(() => {});
    }
  }

  /** مزامنة يدوية فوريّة (زرّ في أعلى الصفحة) */
  async syncNow() {
    if (!this.sync.hasPassphrase() || this.syncing()) return;
    this.syncing.set(true);
    try {
      await this.dict.syncNow();
    } finally {
      this.syncing.set(false);
    }
  }

  // ─── فلترة حسب اليوم (نمط الكاردات) ───
  /** 'all' لعرض جميع الأيام، أو مفتاح يوم YYYY-MM-DD */
  readonly selectedDay = signal<string>('all');

  /** كل الأيام المتاحة (من الأحدث للأقدم) مع عدد الكلمات في كل يوم */
  readonly availableDays = computed(() => {
    const all = this.history();
    const now = new Date();
    const todayKey = this.dayKey(now);
    const yesterdayKey = this.dayKey(new Date(now.getTime() - 86400_000));
    const counts = new Map<string, number>();
    for (const e of all) {
      const k = this.dayKey(new Date(e.ts));
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return Array.from(counts.keys()).sort().reverse().map(k => ({
      key: k,
      label: k === todayKey ? 'اليوم' : k === yesterdayKey ? 'أمس' : this.formatDate(k),
      count: counts.get(k)!,
    }));
  });

  // ─── نمط الكاردات ───
  readonly cardIndex = signal(0);
  readonly flipped = signal(false);
  readonly shuffled = signal(false);
  private shuffledOrder = signal<number[]>([]);

  /** المدخلات المرشّحة حسب اليوم المختار (قبل الخلط) */
  readonly filteredEntries = computed<DictHistoryEntry[]>(() => {
    const all = this.history();
    const day = this.selectedDay();
    if (day === 'all') return all;
    return all.filter(e => this.dayKey(new Date(e.ts)) === day);
  });

  /** ترتيب البطاقات (مخلوط أو أصلي حسب الحالة) */
  readonly deck = computed<DictHistoryEntry[]>(() => {
    const filtered = this.filteredEntries();
    if (!this.shuffled()) return filtered;
    const order = this.shuffledOrder();
    return order.length === filtered.length ? order.map(i => filtered[i]) : filtered;
  });

  readonly currentCard = computed<DictHistoryEntry | null>(() =>
    this.deck()[this.cardIndex()] ?? null,
  );

  // ─── نمط القائمة: مجموعات حسب اليوم ───
  readonly groups = computed<DayGroup[]>(() => {
    const all = this.history();
    if (!all.length) return [];
    const now = new Date();
    const todayKey = this.dayKey(now);
    const yesterdayKey = this.dayKey(new Date(now.getTime() - 86400_000));

    const buckets = new Map<string, DictHistoryEntry[]>();
    for (const e of all) {
      const k = this.dayKey(new Date(e.ts));
      (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(e);
    }
    return Array.from(buckets.keys()).sort().reverse().map<DayGroup>((k) => ({
      key: k,
      label: k === todayKey ? 'Heute' : k === yesterdayKey ? 'Gestern' : this.formatDate(k),
      isToday: k === todayKey,
      entries: buckets.get(k)!,
    }));
  });

  readonly stats = computed(() => {
    const groups = this.groups();
    const total = this.history().length;
    const today = groups.find((g) => g.isToday)?.entries.length ?? 0;
    const withAI = this.history().filter((e) => this.aiOf(e)).length;
    return { total, today, withAI };
  });

  // ─── حالة عرض القائمة (طيّ/فتح) ───
  readonly expanded = signal<Set<string>>(new Set());
  toggle(e: DictHistoryEntry) {
    const k = `${e.kind}:${e.word}`;
    this.expanded.update((s) => {
      const n = new Set(s);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  }
  isExpanded(e: DictHistoryEntry): boolean {
    return this.expanded().has(`${e.kind}:${e.word}`);
  }

  // ─── تبديل النمط ───
  setMode(m: ViewMode) {
    this.mode.set(m);
    if (m === 'cards') {
      this.cardIndex.set(0);
      this.flipped.set(false);
    }
  }

  // ─── تنقّل الكاردات ───
  prev() {
    this.flipped.set(false);
    this.cardIndex.update(i => Math.max(0, i - 1));
  }
  next() {
    this.flipped.set(false);
    this.cardIndex.update(i => Math.min(this.deck().length - 1, i + 1));
  }
  flip() { this.flipped.update(f => !f); }

  /**
   * الضغطة الذكيّة على البطاقة:
   *   - إن كانت غير مقلوبة → اقلب لعرض الترجمة و الشرح.
   *   - إن كانت مقلوبة و لسنا على آخر بطاقة → الانتقال للتالية (مع إغلاق القلب).
   *   - إن كنّا على آخر بطاقة → أغلق القلب فقط.
   */
  cardTap() {
    if (!this.flipped()) { this.flip(); return; }
    if (this.cardIndex() < this.deck().length - 1) this.next();
    else this.flipped.set(false);
  }

  toggleShuffle() {
    const next = !this.shuffled();
    this.shuffled.set(next);
    if (next) {
      this.shuffledOrder.set(shuffle(this.filteredEntries().map((_, i) => i)));
    }
    this.cardIndex.set(0);
    this.flipped.set(false);
  }

  /** يختار يوماً معيّناً و يعيد الكاروسيل للبطاقة الأولى */
  pickDay(dayKey: string) {
    this.selectedDay.set(dayKey);
    this.cardIndex.set(0);
    this.flipped.set(false);
    if (this.shuffled()) {
      this.shuffledOrder.set(shuffle(this.filteredEntries().map((_, i) => i)));
    }
  }

  /** موقع اليوم الحالي ضمن قائمة الأيام (-1 = «الكل») */
  readonly dayNavigator = computed(() => {
    const days = this.availableDays();
    const cur = this.selectedDay();
    const idx = cur === 'all' ? -1 : days.findIndex(d => d.key === cur);
    return {
      idx,
      total: days.length,
      hasPrev: cur === 'all' ? days.length > 0 : idx > 0,
      hasNext: cur === 'all' ? false : idx < days.length - 1 && idx >= 0,
      currentLabel: cur === 'all'
        ? `الكل (${this.history().length})`
        : (idx >= 0 ? `${days[idx].label} (${days[idx].count})` : 'الكل'),
    };
  });

  /** الانتقال ليوم أحدث (يسار في UI العربي، لكن دلالياً «السابق زمنياً») */
  prevDay() {
    const days = this.availableDays();
    if (!days.length) return;
    const cur = this.selectedDay();
    if (cur === 'all') { this.pickDay(days[0].key); return; }
    const idx = days.findIndex(d => d.key === cur);
    if (idx > 0) this.pickDay(days[idx - 1].key);
  }
  /** الانتقال ليوم أقدم */
  nextDay() {
    const days = this.availableDays();
    if (!days.length) return;
    const cur = this.selectedDay();
    if (cur === 'all') return;
    const idx = days.findIndex(d => d.key === cur);
    if (idx >= 0 && idx < days.length - 1) this.pickDay(days[idx + 1].key);
  }

  /** أسئلة سابقة ضمن مدخل مراجعة */
  asksOf(e: DictHistoryEntry): DictAsk[] {
    return (e.asks as DictAsk[] | undefined) ?? [];
  }

  // ─── مساعدات AI ───
  aiOf(e: DictHistoryEntry): ClaudeLookupResult | null {
    if (e.ai) return e.ai as ClaudeLookupResult;
    return this.claude.getCached(e.word);
  }
  aiDeepOf(e: DictHistoryEntry): ClaudeDeepResult | null {
    return (e.aiDeep as ClaudeDeepResult | undefined) ?? null;
  }

  readonly fetchingAI = signal<string | null>(null);
  readonly fetchingDeep = signal<string | null>(null);

  async fetchAI(e: DictHistoryEntry) {
    if (!this.claude.available() || this.fetchingAI()) return;
    this.fetchingAI.set(e.word);
    try {
      await this.claude.lookup(e.word);
      const ai = this.claude.result();
      if (ai) this.dict.enrich(e.word, e.kind, { ai });
    } finally {
      this.fetchingAI.set(null);
    }
  }

  async fetchDeep(e: DictHistoryEntry) {
    if (!this.claude.available() || this.fetchingDeep()) return;
    this.fetchingDeep.set(e.word);
    try {
      const deep = await this.claude.lookupDeep(e.word);
      if (deep) this.dict.enrich(e.word, e.kind, { aiDeep: deep });
    } finally {
      this.fetchingDeep.set(null);
    }
  }

  // ─── أفعال أخرى ───
  speak(text: string, ev?: Event) {
    ev?.stopPropagation();
    this.speech.speak(text);
  }

  remove(e: DictHistoryEntry, ev: Event) {
    ev.stopPropagation();
    this.dict.removeFromHistory(e.word, e.kind);
    // ضبط الفهرس إن حذفنا آخر بطاقة
    if (this.cardIndex() >= this.deck().length) {
      this.cardIndex.set(Math.max(0, this.deck().length - 1));
    }
  }

  clearAll() {
    if (confirm('حذف كل سجلّ البحث؟ (بما في ذلك السحابة)')) {
      this.dict.clearHistory();
    }
  }

  private dayKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  private formatDate(key: string): string {
    const [y, m, d] = key.split('-').map(Number);
    const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    return `${d}. ${months[m - 1]} ${y}`;
  }
}
