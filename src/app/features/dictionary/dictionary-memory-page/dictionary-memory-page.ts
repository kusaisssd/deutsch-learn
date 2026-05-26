import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DictionaryService } from '../../../core/services/dictionary';
import { SpeechService } from '../../../core/services/speech';
import { DictHistoryEntry } from '../../../core/models/dictionary.model';
import { shuffle } from '../../../shared/utils/shuffle';

type Filter = 'all' | 'noun' | 'verb';

/**
 * «ذاكرة قاموسي» — كل الكلمات التي بحثها المستخدم في القاموس تظهر هنا
 * كبطاقات قلب: الوجه الأمامي الكلمة، و عند القلب تظهر الأداة المناسبة
 * (der/die/das) و الترجمة — لتدريب تذكّر الـ Artikel.
 */
@Component({
  selector: 'app-dictionary-memory-page',
  imports: [RouterLink],
  templateUrl: './dictionary-memory-page.html',
  styleUrl: './dictionary-memory-page.scss',
})
export class DictionaryMemoryPage {
  private dict = inject(DictionaryService);
  readonly speech = inject(SpeechService);

  readonly history = this.dict.history;

  readonly filter = signal<Filter>('all');
  /** بذرة الخلط: كل زيادة تُعيد ترتيباً عشوائياً */
  private readonly shuffleSeed = signal(0);

  /** البطاقات المقلوبة (مفتاح = kind:word) */
  private readonly flipped = signal<Set<string>>(new Set());

  /** عدد الأسماء / الأفعال (للفلاتر) */
  readonly counts = computed(() => {
    let noun = 0, verb = 0;
    for (const e of this.history()) e.kind === 'noun' ? noun++ : verb++;
    return { all: this.history().length, noun, verb };
  });

  /** البطاقات المعروضة بعد الفلترة و (اختيارياً) الخلط */
  readonly view = computed<DictHistoryEntry[]>(() => {
    const f = this.filter();
    let list = this.history();
    if (f !== 'all') list = list.filter(e => e.kind === f);
    if (this.shuffleSeed() > 0) return shuffle([...list]);
    return list;
  });

  setFilter(f: Filter) {
    this.filter.set(f);
  }

  shuffleCards() {
    this.flipped.set(new Set());
    this.shuffleSeed.update(s => s + 1);
  }

  private key(e: DictHistoryEntry): string {
    return `${e.kind}:${e.word}`;
  }

  isFlipped(e: DictHistoryEntry): boolean {
    return this.flipped().has(this.key(e));
  }

  toggle(e: DictHistoryEntry) {
    const k = this.key(e);
    this.flipped.update(s => {
      const next = new Set(s);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  }

  remove(e: DictHistoryEntry, event: Event) {
    event.stopPropagation();
    this.dict.removeFromHistory(e.word, e.kind);
  }

  clearAll() {
    if (confirm('حذف كل كلمات الذاكرة؟')) this.dict.clearHistory();
  }

  /** الترجمة العربية المُخبّأة لكلمة (إن وُجدت) */
  translationOf(word: string): string | undefined {
    return this.dict.translationOf(word);
  }

  speak(text: string, event: Event) {
    event.stopPropagation();
    this.speech.speak(text);
  }
}
