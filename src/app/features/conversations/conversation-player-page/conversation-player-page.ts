import { Component, computed, effect, inject, input, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { ConversationsService } from '../../../core/services/conversations';
import { ProgressService } from '../../../core/services/progress';
import { SpeechService } from '../../../core/services/speech';
import { SpeechRecognitionService } from '../../../core/services/speech-recognition';
import { shuffle } from '../../../shared/utils/shuffle';
import { compareGerman, ComparisonResult } from '../../../shared/utils/similarity';
import { WordTile as WordTileComponent } from '../../../shared/components/word-tile/word-tile';

/**
 * مربع كلمة في المحادثة (نفس البنية كما في PracticePage).
 */
interface WordTile {
  word: string;
  originalIndex: number;
}

/** حالة دور المستخدم (نفس النمط من PracticePage) */
type TurnStatus = 'building' | 'correct' | 'wrong';

/**
 * صفحة "تشغيل" محادثة كاملة.
 *
 * 🎯 المفاهيم الجديدة هنا:
 *
 * 1) State Machine عبر signals:
 *    - currentTurnIndex: أي دور نحن فيه
 *    - currentTurn: computed يُرجع الدور الحالي
 *    - isUserTurn / isSystemTurn: computed مساعدة
 *    - allDone: computed يخبرنا إذا انتهت المحادثة
 *
 * 2) إعادة استخدام مكتمل:
 *    - WordTile component (للكلمات المسحوبة)
 *    - DragDropModule (لإعادة الترتيب)
 *    - SpeechService (لقراءة جمل system بالألمانية)
 *
 * 3) Effect جانبي: تشغيل تلقائي لجمل system؟
 *    لا، سنتركها يدوية بزر — تجربة مستخدم أفضل
 *    (تجنّباً للإزعاج بصوت تلقائي).
 */
@Component({
  selector: 'app-conversation-player-page',
  imports: [RouterLink, WordTileComponent, DragDropModule],
  templateUrl: './conversation-player-page.html',
  styleUrl: './conversation-player-page.scss',
})
export class ConversationPlayerPage {
  /**
   * id من URL (مثل 'doctor-headache').
   * لا نحتاج numberAttribute لأنه string.
   */
  readonly id = input.required<string>();

  // ───────── حقن ─────────
  private conversationsService = inject(ConversationsService);
  private progressService = inject(ProgressService);
  /** نعرّض SpeechService كـ public كي نستطيع استخدامه في الـ template */
  readonly speech = inject(SpeechService);
  /** Speech-to-text للنطق و التحقق منه */
  readonly speechRec = inject(SpeechRecognitionService);

  // ───────── بيانات مشتقّة ─────────

  readonly loaded = this.conversationsService.loaded;

  /** المحادثة الحالية (مشتقّة من id) */
  readonly conversation = computed(() =>
    this.conversationsService.conversationById(this.id())()
  );

  /** كل الأدوار */
  readonly turns = computed(() => this.conversation()?.turns ?? []);

  /** كم دور كاملاً (للـ progress bar) */
  readonly totalTurns = computed(() => this.turns().length);

  // ───────── الحالة (state) ─────────

  /**
   * أي دور نحن فيه؟ (0-based)
   *
   * linkedSignal بالصيغة الصريحة: يُعاد لـ 0 كلما تغيّرت المحادثة
   * (مثلاً المستخدم انتقل لمحادثة أخرى عبر الـ URL).
   */
  readonly currentTurnIndex = linkedSignal({
    source: this.conversation,
    computation: () => 0,
  });

  /** الدور الحالي (أو undefined إذا تجاوزنا النهاية) */
  readonly currentTurn = computed(() =>
    this.turns()[this.currentTurnIndex()]
  );

  /** هل انتهت المحادثة؟ */
  readonly allDone = computed(() =>
    this.currentTurnIndex() >= this.totalTurns()
  );

  /** اختصارات مفيدة */
  readonly isSystemTurn = computed(() =>
    this.currentTurn()?.speaker === 'system'
  );
  readonly isUserTurn = computed(() =>
    this.currentTurn()?.speaker === 'user'
  );

  // ───────── حالة دور المستخدم (تُعاد كل دور جديد) ─────────

  /**
   * الكلمات المخلوطة المتاحة للدور الحالي.
   * يُعاد بناؤها كلما تغيّر currentTurn (إما لتغيّر index أو المحادثة).
   */
  readonly availableWords = linkedSignal({
    source: this.currentTurn,
    computation: (turn): WordTile[] => {
      if (!turn || turn.speaker !== 'user') return [];
      return shuffle(
        turn.germanWords.map((word, originalIndex) => ({ word, originalIndex }))
      );
    },
  });

  /** الكلمات التي اختارها المستخدم لهذا الدور */
  readonly selectedWords = linkedSignal({
    source: this.currentTurn,
    computation: (): WordTile[] => [],
  });

  /** حالة دور المستخدم */
  readonly status = linkedSignal({
    source: this.currentTurn,
    computation: (): TurnStatus => 'building',
  });

  /** هل اختار كل الكلمات؟ */
  readonly allWordsSelected = computed(() =>
    this.availableWords().length === 0
  );

  // ───────── 🎙️ Speech recognition state ─────────

  /**
   * نتيجة المقارنة بين ما نطقه المستخدم و الجملة المتوقعة.
   * null = لم يحاول بعد، أو الدور يتغيّر.
   *
   * linkedSignal: يُعاد لـ null كلما تغيّر الدور (currentTurn).
   */
  readonly speechMatchResult = linkedSignal({
    source: this.currentTurn,
    computation: (): ComparisonResult | null => null,
  });

  /**
   * 🎯 Effect: مراقبة آخر transcript و عمل مقارنة تلقائية.
   *
   * كلما تغيّر lastTranscript (وصل نص جديد من الـ Speech API)،
   * نُقارنه بالنطق المتوقع للدور الحالي و نُحدّث speechMatchResult.
   *
   * هذا نمط شائع: ربط signals من services مختلفة عبر effect.
   */
  constructor() {
    // Effect 1: compare user speech against expected German
    effect(() => {
      const transcript = this.speechRec.lastTranscript();
      const turn = this.currentTurn();
      if (!transcript || !turn || turn.speaker !== 'user') return;
      const expected = turn.germanWords.join(' ');
      this.speechMatchResult.set(compareGerman(transcript, expected));
    });

    // Effect 2: mark conversation as completed when all turns are done
    effect(() => {
      if (!this.allDone()) return;
      const conv = this.conversation();
      if (!conv) return;
      this.progressService.markConversationCompleted(conv.id);
    });
  }

  // ───────── الأفعال (Actions) ─────────

  /** اضغط كلمة من المتاحة → تذهب للإجابة */
  pickWord(tile: WordTile) {
    if (this.status() !== 'building') return;
    this.availableWords.update(arr => arr.filter(t => t !== tile));
    this.selectedWords.update(arr => [...arr, tile]);
  }

  /** اضغط كلمة من الإجابة → ترجع للمتاحة */
  unpickWord(tile: WordTile) {
    if (this.status() === 'correct') return;
    this.selectedWords.update(arr => arr.filter(t => t !== tile));
    this.availableWords.update(arr => [...arr, tile]);
    this.status.set('building');
  }

  /** سحب و إفلات لإعادة الترتيب داخل الإجابة */
  drop(event: CdkDragDrop<WordTile[]>) {
    if (this.status() === 'correct') return;
    this.selectedWords.update(arr => {
      const copy = [...arr];
      moveItemInArray(copy, event.previousIndex, event.currentIndex);
      return copy;
    });
    if (this.status() === 'wrong') this.status.set('building');
  }

  /** تحقّق من إجابة دور المستخدم */
  check() {
    const turn = this.currentTurn();
    if (!turn || turn.speaker !== 'user') return;
    const user = this.selectedWords().map(t => t.word);
    const correct = turn.germanWords;
    const isCorrect =
      user.length === correct.length && user.every((w, i) => w === correct[i]);
    this.status.set(isCorrect ? 'correct' : 'wrong');
  }

  /** إعادة المحاولة بدون تغيير الدور */
  reset() {
    const turn = this.currentTurn();
    if (!turn) return;
    this.availableWords.set(
      shuffle(turn.germanWords.map((word, originalIndex) => ({ word, originalIndex })))
    );
    this.selectedWords.set([]);
    this.status.set('building');
  }

  /** الانتقال للدور التالي (يعمل لكل من system و user-correct) */
  nextTurn() {
    this.currentTurnIndex.update(i => i + 1);
  }

  /** قراءة الجملة الألمانية لـ system turn بصوت عالٍ */
  playCurrentTurn() {
    const turn = this.currentTurn();
    if (!turn) return;
    this.speech.speak(turn.germanWords.join(' '));
  }

  /** إعادة المحادثة من البداية */
  restartConversation() {
    this.currentTurnIndex.set(0);
  }

  // ───────── 🎙️ Speech actions ─────────

  /**
   * يبدأ الاستماع للمستخدم (بالألمانية).
   * المتصفح سيطلب صلاحية ميكروفون أول مرة.
   *
   * نمسح النتيجة السابقة قبل البدء كي لا تختلط.
   */
  startListening() {
    this.speechMatchResult.set(null);
    this.speechRec.clearResult();
    this.speechRec.start('de-DE');
  }

  /** إيقاف الاستماع يدوياً */
  stopListening() {
    this.speechRec.stop();
  }

  /**
   * 🔬 وضع تشخيص: نُجرّب الإنجليزية (en-US) للتحقق من أن الـ API
   * يعمل أصلاً. إذا الإنجليزية تعمل و الألمانية لا، فالمشكلة في
   * حزمة لغة Windows.
   */
  testMicEnglish() {
    this.speechMatchResult.set(null);
    this.speechRec.clearResult();
    this.speechRec.start('en-US');
  }
}
