import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ArabicScenariosService } from '../../../core/services/arabic-scenarios';
import { LearnPath } from '../../../core/models/arabic-scenarios.model';

/**
 * Pfad-Auswahl: der Einstieg in /learn-arabic.
 * Der User wählt zwischen Hocharabisch (Fusha) und Syrisch.
 * Die Auswahl wird gespeichert; er kann jederzeit zwischen beiden wechseln.
 */
@Component({
  selector: 'app-arabic-paths-page',
  imports: [RouterLink],
  templateUrl: './arabic-paths-page.html',
})
export class ArabicPathsPage {
  private svc = inject(ArabicScenariosService);
  private router = inject(Router);

  readonly currentPath = this.svc.currentPath;

  choose(path: LearnPath) {
    this.svc.setPath(path);
    this.router.navigate(['/learn-arabic', path]);
  }
}
