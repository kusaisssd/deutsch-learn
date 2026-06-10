import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArabicListeningService } from '../../../core/services/arabic-listening';
import { SpeechService } from '../../../core/services/speech';
import { CelebrationService } from '../../../core/services/celebration';
import { ListeningPassage } from '../../../core/models/arabic-listening.model';
import { shuffle } from '../../../shared/utils/shuffle';

/**
 * صفحة الاستماع و الفهم و النطق.
 *
 * كل تمرين بطاقة مستقلّة:
 *   1) Bouton استماع (Fusha أو Syrisch)
 *   2) كشف النص + النقل اللاتيني + الترجمة الألمانية
 *   3) سؤال فهم بالألمانية (اختيار من متعدّد)
 *   4) شرح بعد الإجابة + نطق المستخدم اختيارياً
 */
@Component({
  selector: 'app-arabic-listening-page',
  imports: [RouterLink],
  templateUrl: './arabic-listening-page.html',
})
export class ArabicListeningPage {
  private svc = inject(ArabicListeningService);
  readonly speech = inject(SpeechService);
  private celebrate = inject(CelebrationService);

  readonly loaded = this.svc.loaded;
  readonly byLevel = this.svc.byLevel;

  readonly levels = [
    { num: 1, label: 'Einfach', emoji: '🟢' },
    { num: 2, label: 'Mittel',  emoji: '🟡' },
    { num: 3, label: 'Schwer',  emoji: '🔴' },
  ];

  /** حالة كل تمرين بمعرّفه: revealed (هل كُشف النص؟) + selected (الخيار المُحدَّد) */
  private readonly _state = signal<Record<string, { revealed: boolean; selected: number | null; order: number[] }>>({});

  state(id: string) {
    return this._state()[id] ?? { revealed: false, selected: null, order: [] };
  }

  reveal(p: ListeningPassage) {
    const cur = this.state(p.id);
    if (cur.revealed) return;
    const order = cur.order.length ? cur.order : shuffle(p.options.map((_, i) => i));
    this._state.update(s => ({ ...s, [p.id]: { revealed: true, selected: null, order } }));
  }

  select(p: ListeningPassage, optionIndex: number) {
    const cur = this.state(p.id);
    if (cur.selected !== null) return;
    this._state.update(s => ({ ...s, [p.id]: { ...cur, selected: optionIndex } }));
    if (optionIndex === p.correct) this.celebrate.small();
  }

  isAnswered(p: ListeningPassage): boolean {
    return this.state(p.id).selected !== null;
  }
  isCorrect(p: ListeningPassage): boolean {
    return this.state(p.id).selected === p.correct;
  }

  /** يبدأ الاستماع و يكشف النص تلقائياً (للسرعة) */
  listen(p: ListeningPassage, form: 'fusha' | 'syrian') {
    this.speech.speak(p[form].ar, 0.85, undefined, 'ar-SA');
    this.reveal(p);
  }
}
