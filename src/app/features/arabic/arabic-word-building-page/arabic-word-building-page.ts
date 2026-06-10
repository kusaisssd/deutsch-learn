import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ArabicWordBuildingService } from '../../../core/services/arabic-word-building';
import { SpeechService } from '../../../core/services/speech';
import { shuffle } from '../../../shared/utils/shuffle';
import { WordBuilding } from '../../../core/models/arabic-word-building.model';

/**
 * صفحة بناء الكلمة:
 *   - المعنى الألماني فوق
 *   - منطقة بناء فارغة (RTL)
 *   - رقائق الأحرف مبعثرة في الأسفل، كل واحدة فيها الاسم + الصوت + 🔊
 *   - عند الترتيب الصحيح: الكلمة كاملة بالتشكيل + نطق + التالي
 */
@Component({
  selector: 'app-arabic-word-building-page',
  imports: [RouterLink],
  templateUrl: './arabic-word-building-page.html',
})
export class ArabicWordBuildingPage {
  readonly wordId = input.required<string>();

  private svc = inject(ArabicWordBuildingService);
  private router = inject(Router);
  readonly speech = inject(SpeechService);

  readonly loaded = this.svc.loaded;
  readonly lookup = computed(() => this.svc.wordLookup(this.wordId())());
  readonly word = computed(() => this.lookup()?.word ?? null);

  /** الترتيب الأصلي للأحرف */
  readonly letters = computed<string[]>(() => this.word()?.letters ?? []);

  /** ترتيب عرض مخلوط (فهارس أصلية) */
  readonly displayOrder = linkedSignal<WordBuilding | null | undefined, number[]>({
    source: this.word,
    computation: (w) => w ? shuffle(w.letters.map((_, i) => i)) : [],
  });

  /** الأحرف المختارة بالترتيب (فهارس أصلية) */
  readonly picked = linkedSignal<WordBuilding | null | undefined, number[]>({
    source: this.word,
    computation: () => [],
  });

  /** هل تمّ التحقّق؟ */
  readonly checked = signal(false);
  /** هل نتيجة بعد التحقّق صحيحة؟ */
  readonly correct = computed(() => {
    const p = this.picked();
    const total = this.letters().length;
    if (p.length !== total) return false;
    return p.every((v, i) => v === i);
  });

  /** الأحرف المتاحة (لم تُختَر بعد) بترتيب العرض */
  readonly available = computed(() => {
    const pickedSet = new Set(this.picked());
    return this.displayOrder().filter(i => !pickedSet.has(i));
  });

  /** هل اكتمل الاختيار (كل الأحرف وُضعت)؟ */
  readonly complete = computed(() => this.picked().length === this.letters().length);

  /** النصّ المُجمَّع (للعرض في منطقة البناء) */
  readonly assembled = computed(() => this.picked().map(i => this.letters()[i]).join(''));

  pickLetter(originalIdx: number) {
    if (this.checked()) return;
    this.picked.update(p => [...p, originalIdx]);
  }

  /** إعادة حرف من منطقة البناء إلى الأسفل */
  unpickAt(position: number) {
    if (this.checked()) return;
    this.picked.update(p => p.filter((_, i) => i !== position));
  }

  check() {
    if (this.complete()) this.checked.set(true);
  }

  reset() {
    this.picked.set([]);
    this.checked.set(false);
  }

  goToWord(id: string) {
    this.router.navigate(['/learn-arabic/wortbildung', id]);
  }

  speakAr(text: string) {
    if (!text) return;
    this.speech.speak(text, 0.85, undefined, 'ar-SA');
  }

  /** معلومات حرف للعرض في الرقاقة */
  infoFor(letter: string) {
    return this.svc.infoFor(letter);
  }
}
