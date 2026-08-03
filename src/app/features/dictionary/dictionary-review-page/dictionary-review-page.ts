import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DictionaryService } from '../../../core/services/dictionary';
import { ClaudeLookupService } from '../../../core/services/claude-lookup';
import { SpeechService } from '../../../core/services/speech';
import { DictHistoryEntry } from '../../../core/models/dictionary.model';

interface DayGroup {
  key: string;              // 'today' | 'yesterday' | '2026-06-08'
  label: string;            // ألماني للعرض
  isToday: boolean;
  entries: DictHistoryEntry[];
}

/**
 * صفحة «مراجعة القاموس» — تجمع كل الكلمات التي بحث عنها المستخدم
 * مقسّمة حسب اليوم. لكل كلمة، إن كان لها استجابة Claude AI محفوظة،
 * تُعرض معها. مثالية للمراجعة المسائية.
 */
@Component({
  selector: 'app-dictionary-review-page',
  imports: [RouterLink],
  templateUrl: './dictionary-review-page.html',
})
export class DictionaryReviewPage {
  private dict = inject(DictionaryService);
  readonly claude = inject(ClaudeLookupService);
  readonly speech = inject(SpeechService);

  readonly history = this.dict.history;

  /** الكلمات المُوسَّعة (اخترتها الآن لعرض ai إن وُجد) */
  readonly expanded = signal<Set<string>>(new Set());

  /** جروبات حسب اليوم — الأحدث أولاً */
  readonly groups = computed<DayGroup[]>(() => {
    const all = this.history();
    if (!all.length) return [];

    const now = new Date();
    const todayKey = this.dayKey(now);
    const yesterdayKey = this.dayKey(new Date(now.getTime() - 86400_000));

    const buckets = new Map<string, DictHistoryEntry[]>();
    for (const e of all) {
      const d = new Date(e.ts);
      const key = this.dayKey(d);
      const arr = buckets.get(key) ?? [];
      arr.push(e);
      buckets.set(key, arr);
    }

    // ترتيب: الأحدث أولاً
    const sortedKeys = Array.from(buckets.keys()).sort().reverse();
    return sortedKeys.map<DayGroup>((k) => ({
      key: k,
      label: k === todayKey ? 'Heute' : k === yesterdayKey ? 'Gestern' : this.formatDate(k),
      isToday: k === todayKey,
      entries: buckets.get(k)!,
    }));
  });

  /** إحصائيات */
  readonly stats = computed(() => {
    const groups = this.groups();
    const total = this.history().length;
    const today = groups.find((g) => g.isToday)?.entries.length ?? 0;
    const withAI = this.history().filter((e) => this.claude.getCached(e.word)).length;
    return { total, today, withAI };
  });

  toggle(entry: DictHistoryEntry) {
    const k = `${entry.kind}:${entry.word}`;
    this.expanded.update((s) => {
      const next = new Set(s);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  }
  isExpanded(entry: DictHistoryEntry): boolean {
    return this.expanded().has(`${entry.kind}:${entry.word}`);
  }

  aiFor(word: string) {
    return this.claude.getCached(word);
  }

  translationOf(word: string) {
    return this.dict.translationOf(word);
  }

  speak(text: string, event?: Event) {
    event?.stopPropagation();
    this.speech.speak(text);
  }

  remove(entry: DictHistoryEntry, event: Event) {
    event.stopPropagation();
    this.dict.removeFromHistory(entry.word, entry.kind);
  }

  clearAll() {
    if (confirm('حذف كل سجلّ البحث؟')) this.dict.clearHistory();
  }

  private dayKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  private formatDate(key: string): string {
    // YYYY-MM-DD → "8. Juni 2026"
    const [y, m, d] = key.split('-').map(Number);
    const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    return `${d}. ${months[m - 1]} ${y}`;
  }
}
