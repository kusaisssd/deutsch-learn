import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArabicService } from '../../../core/services/arabic';
import { SpeechService } from '../../../core/services/speech';
import { CelebrationService } from '../../../core/services/celebration';
import { ArabicWord } from '../../../core/models/arabic.model';
import { shuffle } from '../../../shared/utils/shuffle';

type GameKey = 'memory' | 'audio' | 'dialect';

/** بطاقة لعبة الذاكرة */
interface MemoryCard {
  id: number;
  pairId: number;          // كلتا البطاقتين تحملان نفس pairId
  side: 'de' | 'ar';
  text: string;            // المعروض
  translit?: string;       // النقل (للبطاقات العربية)
}

@Component({
  selector: 'app-arabic-games-page',
  imports: [RouterLink],
  templateUrl: './arabic-games-page.html',
  styleUrl: './arabic-games-page.scss',
})
export class ArabicGamesPage {
  private words = inject(ArabicService);
  readonly speech = inject(SpeechService);
  private celebrate = inject(CelebrationService);

  readonly loaded = this.words.loaded;
  readonly currentGame = signal<GameKey | null>(null);

  /** كل المفردات في قائمة واحدة (للاختيار العشوائي) */
  readonly allWords = computed<ArabicWord[]>(() => {
    const arr: ArabicWord[] = [];
    for (const c of this.words.categories()) arr.push(...c.words);
    return arr;
  });

  openGame(g: GameKey) {
    this.currentGame.set(g);
    if (g === 'memory') this.startMemory();
    else if (g === 'audio') this.startAudio();
    else this.startDialect();
  }

  back() { this.currentGame.set(null); }

  // ═══════════════════════════════════════════
  // 🃏 لعبة الذاكرة (Memory Matching)
  // ═══════════════════════════════════════════
  readonly memoryCards = signal<MemoryCard[]>([]);
  readonly memoryFlipped = signal<number[]>([]); // فهارس مقلوبة حالياً
  readonly memoryMatched = signal<Set<number>>(new Set()); // pairIds مطابقة
  readonly memoryMoves = signal(0);

  private startMemory() {
    const all = this.allWords();
    const sample = shuffle([...all]).slice(0, 6);
    const cards: MemoryCard[] = [];
    sample.forEach((w, i) => {
      cards.push({ id: i * 2, pairId: i, side: 'de', text: w.de });
      cards.push({ id: i * 2 + 1, pairId: i, side: 'ar', text: w.fusha.ar, translit: w.fusha.translit });
    });
    this.memoryCards.set(shuffle(cards));
    this.memoryFlipped.set([]);
    this.memoryMatched.set(new Set());
    this.memoryMoves.set(0);
  }

  isMemoryFlipped(idx: number): boolean {
    return this.memoryFlipped().includes(idx);
  }
  isMemoryMatched(card: MemoryCard): boolean {
    return this.memoryMatched().has(card.pairId);
  }
  readonly memoryWon = computed(() => {
    const cards = this.memoryCards();
    if (cards.length === 0) return false;
    return this.memoryMatched().size === cards.length / 2;
  });

  flipMemory(idx: number) {
    const card = this.memoryCards()[idx];
    if (this.isMemoryMatched(card) || this.isMemoryFlipped(idx)) return;
    const flipped = this.memoryFlipped();
    if (flipped.length >= 2) return;

    const next = [...flipped, idx];
    this.memoryFlipped.set(next);

    if (next.length === 2) {
      this.memoryMoves.update(m => m + 1);
      const [a, b] = next;
      const ca = this.memoryCards()[a];
      const cb = this.memoryCards()[b];
      if (ca.pairId === cb.pairId) {
        // match
        setTimeout(() => {
          this.memoryMatched.update(s => new Set(s).add(ca.pairId));
          this.memoryFlipped.set([]);
          if (this.memoryWon()) this.celebrate.big();
          else this.celebrate.small();
        }, 500);
      } else {
        setTimeout(() => this.memoryFlipped.set([]), 1000);
      }
    } else {
      // نطق البطاقة العربية تلقائياً عند قلبها
      if (card.side === 'ar') this.speakAr(card.text);
    }
  }

  // ═══════════════════════════════════════════
  // 🎧 Audio Quiz: استمع و اختر الترجمة
  // ═══════════════════════════════════════════
  readonly audioRound = signal(0);
  readonly audioScore = signal(0);
  readonly audioCurrent = signal<ArabicWord | null>(null);
  readonly audioOptions = signal<ArabicWord[]>([]);
  readonly audioSelected = signal<number | null>(null);
  readonly TOTAL_ROUNDS = 10;

  private startAudio() {
    this.audioRound.set(0);
    this.audioScore.set(0);
    this.nextAudio();
  }

  nextAudio() {
    if (this.audioRound() >= this.TOTAL_ROUNDS) return;
    this.audioRound.update(r => r + 1);
    this.audioSelected.set(null);

    const pool = this.allWords();
    const correct = pool[Math.floor(Math.random() * pool.length)];
    // 3 إجابات خطأ
    const others = shuffle(pool.filter(w => w.de !== correct.de)).slice(0, 3);
    const options = shuffle([correct, ...others]);
    this.audioCurrent.set(correct);
    this.audioOptions.set(options);
    // تشغيل تلقائي بعد لحظة
    setTimeout(() => this.speakAr(correct.fusha.ar), 200);
  }

  selectAudio(opt: ArabicWord, idx: number) {
    if (this.audioSelected() !== null) return;
    this.audioSelected.set(idx);
    if (opt.de === this.audioCurrent()!.de) {
      this.audioScore.update(s => s + 1);
      this.celebrate.small();
    }
  }
  isAudioCorrect(idx: number): boolean {
    const sel = this.audioSelected();
    if (sel === null) return false;
    return this.audioOptions()[idx].de === this.audioCurrent()!.de;
  }
  isAudioWrong(idx: number): boolean {
    const sel = this.audioSelected();
    return sel === idx && !this.isAudioCorrect(idx);
  }
  readonly audioDone = computed(() =>
    this.audioRound() >= this.TOTAL_ROUNDS && this.audioSelected() !== null);

  audioRestart() { this.startAudio(); }
  audioFinish() {
    // اعتبر اللعبة منتهية
    const score = this.audioScore();
    if (score >= this.TOTAL_ROUNDS * 0.7) this.celebrate.big();
  }

  replayAudio() {
    const c = this.audioCurrent();
    if (c) this.speakAr(c.fusha.ar);
  }

  // ═══════════════════════════════════════════
  // 🇸🇾 Dialect Match: فصحى → اختر السورية الصحيحة
  // ═══════════════════════════════════════════
  readonly dialectRound = signal(0);
  readonly dialectScore = signal(0);
  readonly dialectCurrent = signal<ArabicWord | null>(null);
  readonly dialectOptions = signal<ArabicWord[]>([]);
  readonly dialectSelected = signal<number | null>(null);

  private startDialect() {
    this.dialectRound.set(0);
    this.dialectScore.set(0);
    this.nextDialect();
  }

  nextDialect() {
    if (this.dialectRound() >= this.TOTAL_ROUNDS) return;
    this.dialectRound.update(r => r + 1);
    this.dialectSelected.set(null);

    const pool = this.allWords();
    // اختر كلمة فصحى و سوريّة تختلفان (لجعل التحدّي حقيقياً)
    let correct: ArabicWord;
    let attempts = 0;
    do {
      correct = pool[Math.floor(Math.random() * pool.length)];
      attempts++;
    } while (correct.fusha.ar === correct.syrian.ar && attempts < 10);

    const others = shuffle(pool.filter(w => w.syrian.ar !== correct.syrian.ar)).slice(0, 3);
    const options = shuffle([correct, ...others]);
    this.dialectCurrent.set(correct);
    this.dialectOptions.set(options);
  }

  selectDialect(opt: ArabicWord, idx: number) {
    if (this.dialectSelected() !== null) return;
    this.dialectSelected.set(idx);
    if (opt.syrian.ar === this.dialectCurrent()!.syrian.ar) {
      this.dialectScore.update(s => s + 1);
      this.celebrate.small();
    }
  }
  isDialectCorrect(idx: number): boolean {
    const sel = this.dialectSelected();
    if (sel === null) return false;
    return this.dialectOptions()[idx].syrian.ar === this.dialectCurrent()!.syrian.ar;
  }
  isDialectWrong(idx: number): boolean {
    const sel = this.dialectSelected();
    return sel === idx && !this.isDialectCorrect(idx);
  }
  readonly dialectDone = computed(() =>
    this.dialectRound() >= this.TOTAL_ROUNDS && this.dialectSelected() !== null);

  dialectRestart() { this.startDialect(); }
  dialectFinish() {
    if (this.dialectScore() >= this.TOTAL_ROUNDS * 0.7) this.celebrate.big();
  }

  // ═══════════════════════════════════════════
  speakAr(text: string) {
    this.speech.speak(text, 0.85, undefined, 'ar-SA');
  }
}
