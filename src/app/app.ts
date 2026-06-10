import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { Celebration } from './shared/components/celebration/celebration';

@Component({
  selector: 'app-root',
  // نستورد RouterOutlet ليعرض الصفحات، و RouterLink لشريط التنقل،
  // و Celebration ليعرض الاحتفاء العربي عند الإنجازات.
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Celebration],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('deutsch-learn');
}
