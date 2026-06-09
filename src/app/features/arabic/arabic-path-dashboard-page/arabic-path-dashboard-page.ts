import { Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ArabicScenariosService } from '../../../core/services/arabic-scenarios';
import { LearnPath } from '../../../core/models/arabic-scenarios.model';

/**
 * Pfad-Übersicht: zeigt alle Szenarien des gewählten Pfads,
 * gruppiert nach Kategorien (Soziales, Essen, Reisen, …).
 */
@Component({
  selector: 'app-arabic-path-dashboard-page',
  imports: [RouterLink],
  templateUrl: './arabic-path-dashboard-page.html',
})
export class ArabicPathDashboardPage {
  readonly path = input.required<string>();

  private svc = inject(ArabicScenariosService);
  private router = inject(Router);

  readonly pathValue = computed<LearnPath>(() => (this.path() === 'syrian' ? 'syrian' : 'fusha'));
  readonly loaded = this.svc.loaded;
  readonly categories = this.svc.categories;
  readonly byCategory = computed(() => this.svc.scenariosByCategoryForPath(this.pathValue())());

  /** عنوان المسار + لون */
  readonly pathInfo = computed(() => this.pathValue() === 'fusha'
    ? { name: 'Hocharabisch (Fusha)', emoji: '📚', color: 'indigo' }
    : { name: 'Syrisch-Levantinisch', emoji: '🇸🇾', color: 'rose' });

  readonly stats = computed(() => {
    const list = this.svc.scenariosForPath(this.pathValue())();
    const done = list.filter(s => this.svc.isDone(this.pathValue(), s.id)).length;
    return { done, total: list.length };
  });

  isDone(scenarioId: string): boolean {
    return this.svc.isDone(this.pathValue(), scenarioId);
  }

  switchPath() {
    this.svc.resetPath();
    this.router.navigate(['/learn-arabic']);
  }
}
