import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArabicDailyService } from '../../../core/services/arabic-daily';
import { SpeechService } from '../../../core/services/speech';
import { CelebrationService } from '../../../core/services/celebration';

@Component({
  selector: 'app-arabic-daily-page',
  imports: [RouterLink],
  templateUrl: './arabic-daily-page.html',
})
export class ArabicDailyPage implements OnInit {
  private svc = inject(ArabicDailyService);
  readonly speech = inject(SpeechService);
  private celebrate = inject(CelebrationService);

  readonly wordOfDay = this.svc.wordOfDay;
  readonly state = this.svc.state;
  readonly ready = this.svc.ready;

  ngOnInit(): void {
    // يحدّث السلسلة (streak) عند الفتح
    this.svc.init();
  }

  speakAr(text: string) {
    this.speech.speak(text, 0.85, undefined, 'ar-SA');
  }

  done() {
    if (this.state().doneToday) return;
    this.svc.markDone();
    this.celebrate.big();
  }
}
