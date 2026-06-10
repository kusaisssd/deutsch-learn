import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArabicService } from '../../../core/services/arabic';
import { ArabicScenariosService } from '../../../core/services/arabic-scenarios';
import { ArabicAlphabetService } from '../../../core/services/arabic-alphabet';
import { ArabicListeningService } from '../../../core/services/arabic-listening';
import { SpeechService } from '../../../core/services/speech';
import { SpeechRecognitionService } from '../../../core/services/speech-recognition';
import { CelebrationService } from '../../../core/services/celebration';
import { ArabicWord } from '../../../core/models/arabic.model';
import { BilingualVocab } from '../../../core/models/arabic-scenarios.model';
import { shuffle } from '../../../shared/utils/shuffle';

type GameKey = 'memory' | 'audio' | 'dialect' | 'speak';

/** جملة قابلة للنطق: ثنائية + ترجمة + معرّف */
interface SpeakSentence {
  fusha: { ar: string; translit: string };
  syrian: { ar: string; translit: string };
  de: string;
}

/** تطبيع نص عربي للمقارنة: حذف التشكيل، توحيد الألفات و التاء المربوطة */
function normalizeArabic(s: string): string {
  return s
    .replace(/[ً-ْٰ]/g, '')   // tashkeel + diacritics
    .replace(/[أإآٱ]/g, 'ا')                  // alif variants → bare alif
    .replace(/ى/g, 'ي')                      // alif maqsura → ya
    .replace(/ة/g, 'ه')                      // ta marbuta → ha
    .replace(/[ؤئ]/g, '')                    // hamza on letter → drop
    .replace(/[^ء-غف-ي\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
}

function arabicSimilarity(spoken: string, expected: string): number {
  const a = normalizeArabic(spoken);
  const b = normalizeArabic(expected);
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const dist = levenshtein(a, b);
  const max = Math.max(a.length, b.length);
  return Math.max(0, 1 - dist / max);
}

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
  private scenarios = inject(ArabicScenariosService);
  private alphabet = inject(ArabicAlphabetService);
  private listening = inject(ArabicListeningService);
  readonly speech = inject(SpeechService);
  readonly speechRec = inject(SpeechRecognitionService);
  private celebrate = inject(CelebrationService);

  readonly loaded = this.words.loaded;
  readonly currentGame = signal<GameKey | null>(null);

  /** كل المفردات من القاموس (للذاكرة و Hör-Quiz) */
  readonly allWords = computed<ArabicWord[]>(() => {
    const arr: ArabicWord[] = [];
    for (const c of this.words.categories()) arr.push(...c.words);
    return arr;
  });

  /**
   * مجموعة كلمات موسّعة لـ Dialekt-Spiel:
   * تجمع 218 كلمة قاموس + مفردات السيناريوهات + أمثلة الأحرف (~500+)،
   * مع إزالة المتكرّرات و الكلمات التي تتطابق فيها الفصحى مع السورية
   * (لا فائدة من اللعبة لها).
   */
  readonly expandedDialectPool = computed<BilingualVocab[]>(() => {
    const map = new Map<string, BilingualVocab>();
    const add = (v: BilingualVocab) => {
      if (!v.fusha?.ar || !v.syrian?.ar || !v.de) return;
      if (v.fusha.ar === v.syrian.ar) return; // ما في فرق
      const key = `${v.fusha.ar}::${v.syrian.ar}`;
      if (!map.has(key)) map.set(key, v);
    };

    // 1) قاموس المفردات
    for (const c of this.words.categories()) {
      for (const w of c.words) add(w as BilingualVocab);
    }
    // 2) مفردات السيناريوهات
    for (const s of this.scenarios.scenarios()) {
      for (const st of s.steps) {
        if (st.kind === 'vocab') {
          for (const item of st.items) add(item);
        }
      }
    }
    // 3) أمثلة الأحرف
    for (const l of this.alphabet.letters()) {
      for (const ex of l.examples) add(ex);
    }
    return Array.from(map.values());
  });

  openGame(g: GameKey) {
    this.currentGame.set(g);
    if (g === 'memory') this.startMemory();
    else if (g === 'audio') this.startAudio();
    else if (g === 'dialect') this.startDialect();
    else this.startSpeak();
  }

  back() {
    this.speechRec.stop();
    this.currentGame.set(null);
  }

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
  /** عدد جولات Dialekt الخاصّ (أكثر من باقي الألعاب لأن المخزون أكبر) */
  readonly DIALECT_ROUNDS = 15;

  readonly dialectRound = signal(0);
  readonly dialectScore = signal(0);
  readonly dialectCurrent = signal<BilingualVocab | null>(null);
  readonly dialectOptions = signal<BilingualVocab[]>([]);
  readonly dialectSelected = signal<number | null>(null);

  private startDialect() {
    this.dialectRound.set(0);
    this.dialectScore.set(0);
    this.nextDialect();
  }

  nextDialect() {
    if (this.dialectRound() >= this.DIALECT_ROUNDS) return;
    this.dialectRound.update(r => r + 1);
    this.dialectSelected.set(null);

    // المخزون الموسّع: قاموس + سيناريوهات + أمثلة أحرف (مع تفعيل الفلاتر)
    const pool = this.expandedDialectPool();
    if (pool.length < 4) {
      // fallback: استخدم القاموس فقط
      const fallback = this.allWords() as unknown as BilingualVocab[];
      const f = fallback[Math.floor(Math.random() * fallback.length)];
      const others = shuffle(fallback.filter(w => w.syrian.ar !== f.syrian.ar)).slice(0, 3);
      this.dialectCurrent.set(f);
      this.dialectOptions.set(shuffle([f, ...others]));
      return;
    }
    const correct = pool[Math.floor(Math.random() * pool.length)];
    const others = shuffle(pool.filter(w => w.syrian.ar !== correct.syrian.ar)).slice(0, 3);
    this.dialectCurrent.set(correct);
    this.dialectOptions.set(shuffle([correct, ...others]));
  }

  selectDialect(opt: BilingualVocab, idx: number) {
    if (this.dialectSelected() !== null) return;
    this.dialectSelected.set(idx);
    const correct = this.dialectCurrent()!;
    if (opt.syrian.ar === correct.syrian.ar) {
      this.dialectScore.update(s => s + 1);
      this.celebrate.small();
    }
    // نطق تلقائي للسورية الصحيحة بعد لحظة
    setTimeout(() => this.speakAr(correct.syrian.ar), 400);
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
    this.dialectRound() >= this.DIALECT_ROUNDS && this.dialectSelected() !== null);

  dialectRestart() { this.startDialect(); }
  dialectFinish() {
    if (this.dialectScore() >= this.DIALECT_ROUNDS * 0.7) this.celebrate.big();
  }

  // ═══════════════════════════════════════════
  // 🎤 Sprechen: انطق الجملة و قارن
  // ═══════════════════════════════════════════
  readonly SPEAK_ROUNDS = 10;
  /** اللهجة المُختارة للنطق (افتراضي: Fusha — Web Speech يدعمها أفضل) */
  readonly speakDialect = signal<'fusha' | 'syrian'>('fusha');
  readonly speakRound = signal(0);
  readonly speakScore = signal(0);
  readonly speakCurrent = signal<SpeakSentence | null>(null);
  readonly speakSimilarity = signal<number | null>(null);
  readonly speakRecognized = signal<string>('');
  /** هل يسجّل الآن؟ (للزرّ) */
  readonly speakRecording = this.speechRec.isListening;
  readonly speakSupported = this.speechRec.isSupported;

  /** مجموعة الجمل: من تمارين الاستماع + سطور الحوارات */
  readonly speakPool = computed<SpeakSentence[]>(() => {
    const out: SpeakSentence[] = [];
    // 1) تمارين الاستماع (15)
    for (const p of this.listening.passages()) {
      out.push({ fusha: p.fusha, syrian: p.syrian, de: p.de });
    }
    // 2) سطور الحوارات
    for (const s of this.scenarios.scenarios()) {
      for (const st of s.steps) {
        if (st.kind === 'dialogue') {
          for (const line of st.lines) {
            out.push({
              fusha: line.sentence.fusha,
              syrian: line.sentence.syrian,
              de: line.sentence.de,
            });
          }
        }
      }
    }
    return out;
  });

  setSpeakDialect(d: 'fusha' | 'syrian') {
    this.speechRec.stop();
    this.speakDialect.set(d);
  }

  private startSpeak() {
    this.speechRec.stop();
    this.speakRound.set(0);
    this.speakScore.set(0);
    this.speakSimilarity.set(null);
    this.speakRecognized.set('');
    this.nextSpeak();
  }

  nextSpeak() {
    this.speechRec.stop();
    this.speechRec.clearResult();
    this.speakSimilarity.set(null);
    this.speakRecognized.set('');
    if (this.speakRound() >= this.SPEAK_ROUNDS) return;
    this.speakRound.update(r => r + 1);
    const pool = this.speakPool();
    if (!pool.length) return;
    this.speakCurrent.set(pool[Math.floor(Math.random() * pool.length)]);
  }

  startSpeakRecording() {
    this.speechRec.clearResult();
    this.speakSimilarity.set(null);
    this.speakRecognized.set('');
    this.speechRec.start('ar-SA');
  }
  stopSpeakRecording() {
    this.speechRec.stop();
  }

  /** يحسب التشابه عند وصول نتيجة من التعرّف الصوتي */
  constructor() {
    effect(() => {
      const transcript = this.speechRec.lastTranscript();
      const cur = this.speakCurrent();
      if (!transcript || !cur || this.currentGame() !== 'speak') return;
      const expected = cur[this.speakDialect()].ar;
      const sim = arabicSimilarity(transcript, expected);
      this.speakRecognized.set(transcript);
      this.speakSimilarity.set(sim);
      if (sim >= 0.7) {
        this.speakScore.update(s => s + 1);
        this.celebrate.small();
      }
    });
  }

  /** نسبة مئوية مدوّرة */
  pct(n: number): number { return Math.round(n * 100); }

  speakRestart() { this.startSpeak(); }

  // ═══════════════════════════════════════════
  speakAr(text: string) {
    this.speech.speak(text, 0.85, undefined, 'ar-SA');
  }
}
