import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArabicScenariosService } from '../../../core/services/arabic-scenarios';

/**
 * Übersicht /learn-arabic: vereinheitlichte Landung.
 * Zeigt Grundlagen (Alphabet + Wortschatz) und alle Szenarien nach Kategorien.
 * Fusha & Syrisch werden später innerhalb jedes Schritts beide angezeigt.
 */
@Component({
  selector: 'app-arabic-path-dashboard-page',
  imports: [RouterLink],
  templateUrl: './arabic-path-dashboard-page.html',
})
export class ArabicPathDashboardPage {
  private svc = inject(ArabicScenariosService);

  readonly loaded = this.svc.loaded;
  readonly categories = this.svc.categories;
  readonly byCategory = this.svc.scenariosByCategory;

  readonly stats = computed(() => {
    const list = this.svc.scenarios();
    const done = list.filter(s => this.svc.isDone(s.id)).length;
    return { done, total: list.length };
  });

  isDone(scenarioId: string): boolean { return this.svc.isDone(scenarioId); }
}
