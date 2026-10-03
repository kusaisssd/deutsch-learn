import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { B2PruefungService } from '../../../core/services/b2-pruefung';
import { SpeechService } from '../../../core/services/speech';
import { B2TeilA, B2TeilB, B2TeilC, B2TeilD, B2TeilE } from '../../../core/models/b2-pruefung.model';

@Component({
  selector: 'app-b2-sitzung-page',
  imports: [RouterLink],
  templateUrl: './b2-sitzung-page.html',
})
export class B2SitzungPage {
  svc = inject(B2PruefungService);
  speech = inject(SpeechService);

  /** URL parameter: /b2-pruefung/:sitzungId */
  readonly sitzungId = input.required<string>();

  readonly sitzung = computed(() => this.svc.getSitzung(this.sitzungId()));

  /** حالة طيّ لكل Teil (مفتوح/مغلق) — افتراضياً فقط Teil A مفتوح */
  readonly expanded = signal<Record<string, boolean>>({ A: true, B: false, C: false, D: false, E: false });

  readonly nextSitzung = computed(() => {
    const list = this.svc.sitzungen();
    const cur = this.sitzung();
    if (!cur) return null;
    const idx = list.findIndex(s => s.id === cur.id);
    return idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;
  });

  readonly prevSitzung = computed(() => {
    const list = this.svc.sitzungen();
    const cur = this.sitzung();
    if (!cur) return null;
    const idx = list.findIndex(s => s.id === cur.id);
    return idx > 0 ? list[idx - 1] : null;
  });

  toggleTeil(key: string) {
    this.expanded.update(e => ({ ...e, [key]: !e[key] }));
  }

  isExpanded(key: string) { return this.expanded()[key] ?? false; }

  speak(text: string, ev?: Event) {
    ev?.stopPropagation();
    this.speech.speak(text);
  }

  // ─── نوع-ضيّق: مساعد type guards للقالب ───
  asA(t: unknown): B2TeilA | null { return (t as B2TeilA).typ === 'wortschatz_lesen' ? (t as B2TeilA) : null; }
  asB(t: unknown): B2TeilB | null { return (t as B2TeilB).typ === 'grammatik' ? (t as B2TeilB) : null; }
  asC(t: unknown): B2TeilC | null { return (t as B2TeilC).typ === 'hoeren' ? (t as B2TeilC) : null; }
  asD(t: unknown): B2TeilD | null { return (t as B2TeilD).typ === 'sprechen' ? (t as B2TeilD) : null; }
  asE(t: unknown): B2TeilE | null { return (t as B2TeilE).typ === 'schreiben' ? (t as B2TeilE) : null; }
}
