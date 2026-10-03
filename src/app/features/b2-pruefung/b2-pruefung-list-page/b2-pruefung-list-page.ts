import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { B2PruefungService } from '../../../core/services/b2-pruefung';

@Component({
  selector: 'app-b2-pruefung-list-page',
  imports: [RouterLink],
  templateUrl: './b2-pruefung-list-page.html',
})
export class B2PruefungListPage {
  svc = inject(B2PruefungService);
}
