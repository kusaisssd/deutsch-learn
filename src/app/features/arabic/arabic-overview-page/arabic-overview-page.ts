import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArabicCourseService } from '../../../core/services/arabic-course';

/**
 * Overview-Seite des Kurses „Arabisch für Deutschsprachige“.
 *
 * Zeigt alle Lektionen in 3 Phasen (Alphabet, Lesen, Sätze bauen) mit
 * Locked-Progression: nächste Lektion öffnet sich erst nach Abschluss
 * der vorherigen.
 */
@Component({
  selector: 'app-arabic-overview-page',
  imports: [RouterLink],
  templateUrl: './arabic-overview-page.html',
})
export class ArabicOverviewPage {
  private svc = inject(ArabicCourseService);

  readonly loaded = this.svc.loaded;
  readonly course = this.svc.course;
  readonly states = this.svc.lektionStates;

  readonly phases = [
    { num: 1, de: 'Phase 1 — Alphabet', emoji: '🔤', hint: 'Alle 28 arabischen Buchstaben' },
    { num: 2, de: 'Phase 2 — Lesen', emoji: '📖', hint: 'Vokale, Artikel, erste Wörter' },
    { num: 4, de: 'Phase 3 — Sätze bauen', emoji: '🧩', hint: 'Eigene Sätze formen' },
  ];

  /** درس مجمّع حسب المرحلة */
  statesByPhase(phase: number) {
    return computed(() => this.states().filter(s => s.lektion.phase === phase));
  }

  readonly stats = computed(() => {
    const all = this.states();
    return { done: all.filter(s => s.done).length, total: all.length };
  });

  /** الدرس التالي للمتابعة (أول درس غير منجز) */
  readonly nextLektion = computed(() => {
    const all = this.states();
    return all.find(s => !s.done) ?? null;
  });
}
