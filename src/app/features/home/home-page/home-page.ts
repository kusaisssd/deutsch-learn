import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProgressService } from '../../../core/services/progress';
import { SentencesService } from '../../../core/services/sentences';
import { LevelCode } from '../../../core/models/level.model';

/**
 * 🏠 HomePage — the landing page.
 *
 * Shows the learning methodology + 3 entry points (sentences, conversations, reader)
 * + personalized progress stats (or a welcoming "new user" message).
 *
 * 🎯 Patterns used here:
 *   - inject() for modern DI
 *   - computed() to derive UI-ready data from service signals
 *   - Record<LevelCode, number> for per-level counters
 */
@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage {
  // ───────── Services ─────────
  private progress = inject(ProgressService);
  private sentences = inject(SentencesService);

  // ───────── Derived data ─────────

  /** Total number of sentences the user has marked as completed. */
  readonly totalMastered = computed(() => this.progress.completedIds().size);

  /** Total number of sentences available in the app (across all levels). */
  readonly totalAvailable = computed(() => this.sentences.sentences().length);

  /**
   * How many sentences are completed in each level.
   *
   * Record<LevelCode, number> = object keyed by 'A1'|'A2'|'B1'|'B2', values are counts.
   * Equivalent to C#: Dictionary<LevelCode, int>.
   */
  readonly perLevel = computed<Record<LevelCode, number>>(() => {
    const stats: Record<LevelCode, number> = { A1: 0, A2: 0, B1: 0, B2: 0 };
    const completed = this.progress.completedIds();
    for (const s of this.sentences.sentences()) {
      if (completed.has(s.id)) stats[s.level]++;
    }
    return stats;
  });

  /**
   * The "current focus" level = the highest level where the user has any progress.
   * Returns null if the user hasn't started yet.
   *
   * Logic: walk levels from B2 → A1, return the first one with done > 0.
   */
  readonly currentLevel = computed<LevelCode | null>(() => {
    const stats = this.perLevel();
    const levels: LevelCode[] = ['B2', 'B1', 'A2', 'A1'];
    for (const level of levels) {
      if (stats[level] > 0) return level;
    }
    return null;
  });

  /** True if the user has completed at least one sentence. */
  readonly hasStarted = computed(() => this.totalMastered() > 0);

  /**
   * Progress as a percentage (0-100), used for the bar width.
   * Guards against divide-by-zero before sentences are loaded.
   */
  readonly progressPercent = computed(() => {
    const total = this.totalAvailable();
    if (total === 0) return 0;
    return Math.round((this.totalMastered() / total) * 100);
  });
}
