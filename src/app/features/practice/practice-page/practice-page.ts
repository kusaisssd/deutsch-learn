import { Component, computed, inject, input, linkedSignal, numberAttribute } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { SentencesService } from '../../../core/services/sentences';
import { ProgressService } from '../../../core/services/progress';
import { SpeechService } from '../../../core/services/speech';
import { shuffle } from '../../../shared/utils/shuffle';
import { WordTile as WordTileComponent } from '../../../shared/components/word-tile/word-tile';

/**
 * تمثيل "بلاط كلمة" واحد.
 * نحتاج originalIndex كي نميّز بين كلمات متشابهة (مثلاً "die" مرتين).
 */
interface WordTile {
  word: string;
  originalIndex: number;   // موقع الكلمة في الجملة الأصلية
}

/** حالات اللعبة */
type GameStatus = 'building' | 'correct' | 'wrong';

/**
 * صفحة التمرين (لعبة ترتيب الكلمات).
 *
 * مسار الـ URL: /practice/5
 * يقرأ sentenceId من URL، يجلب الجملة، يخلط كلماتها، و يدع المستخدم يرتّبها.
 *
 * حالات اللعبة (status):
 *   'building'  → المستخدم يرتّب
 *   'correct'   → نجح ✅
 *   'wrong'     → ترتيب خاطئ، حاول مجدداً
 */
@Component({
  selector: 'app-practice-page',
  // DragDropModule يجلب كل directives: cdkDrag, cdkDropList, (cdkDropListDropped)
  imports: [RouterLink, WordTileComponent, DragDropModule],
  templateUrl: './practice-page.html',
  styleUrl: './practice-page.scss',
})
export class PracticePage {
  /**
   * sentenceId من الـ URL.
   * numberAttribute = transformer يحوّل قيمة الـ URL (نص) إلى رقم تلقائياً.
   * بدونه ستكون '5' (نص) بدل 5 (رقم).
   */
  readonly sentenceId = input.required<number, string>({
    transform: numberAttribute,
  });

  // ───────── الحقن ─────────
  private sentencesService = inject(SentencesService);
  private progressService = inject(ProgressService);
  private router = inject(Router);
  /**
   * 🆕 SpeechService نُعرّضه public كي نستطيع قراءة isSpeaking() مباشرة في الـ template.
   * نُريد تعطيل زر Listen أثناء التحدث الجاري (UX أفضل).
   */
  readonly speech = inject(SpeechService);

  // ───────── البيانات المشتقّة ─────────

  /** هل تم تحميل البيانات من JSON؟ */
  readonly loaded = this.sentencesService.loaded;

  /**
   * الجملة الحالية (مشتقّة من id).
   * يعتمد على:
   *   - sentenceId (من الـ URL)
   *   - sentences (من الـ service، تتغير لما يحمّل JSON)
   * أي تغيّر في أيّهما → يُعاد الحساب.
   */
  readonly sentence = computed(() => {
    const id = this.sentenceId();
    return this.sentencesService.sentences().find(s => s.id === id);
  });

  // ───────── الحالة القابلة للتعديل ─────────

  /**
   * 🔑 نستخدم الصيغة الصريحة لـ linkedSignal: { source, computation }
   *
   * لماذا الصيغة الصريحة و ليست المختصرة؟
   *   لأن الصيغة المختصرة `linkedSignal(() => 'building')` تقارن الـ
   *   النتيجة بالناتج السابق. إذا كانت متطابقة (نفس النص 'building')،
   *   لا تُعيد الضبط، حتى لو الجملة تغيّرت!
   *
   *   الصيغة الصريحة تُعيد الضبط دائماً كلما تغيّر المصدر (sentence)،
   *   بغض النظر عن ناتج الـ computation. هذا ما نريده بالضبط.
   */

  /**
   * الكلمات المتاحة (مخلوطة).
   * المصدر: الجملة. كلما تغيّرت → نخلط الكلمات من جديد.
   *
   * ملاحظة: لا نضع <Generic> صراحة، نترك TypeScript يستنتج من
   * نوع الـ source و الـ computation (هذا يجعله يختار الـ overload الصحيح).
   */
  readonly availableWords = linkedSignal({
    source: this.sentence,
    computation: (s): WordTile[] => {
      if (!s) return [];
      return shuffle(
        s.germanWords.map((word, originalIndex) => ({ word, originalIndex }))
      );
    },
  });

  /**
   * الكلمات التي اختارها المستخدم (مرتبة).
   * كلما تغيّرت الجملة → نُعيد القائمة للفراغ.
   */
  readonly selectedWords = linkedSignal({
    source: this.sentence,
    computation: (): WordTile[] => [],
  });

  /**
   * حالة اللعبة.
   * كلما تغيّرت الجملة → ترجع لـ 'building' (هذا كان الـ bug سابقاً).
   */
  readonly status = linkedSignal({
    source: this.sentence,
    computation: (): GameStatus => 'building',
  });

  /**
   * هل استخدم المستخدم زر Help لهذه الجملة؟
   *
   * 🎯 لماذا linkedSignal و ليس signal عادي؟
   *   لو signal عادي = true، يبقى true إلى الأبد.
   *   linkedSignal مع source = sentence → يُعاد للـ false عند كل جملة جديدة.
   *
   * فائدة: لو ضغط Help على الجملة 1، ثم انتقل للجملة 2 — يبدأ نظيفاً.
   */
  readonly helpUsed = linkedSignal({
    source: this.sentence,
    computation: () => false,
  });

  /**
   * هل قسم شرح القاعدة (grammar) مفتوح؟
   * يبدأ مغلقاً، يفتحه المستخدم بالضغط.
   * عند تغيّر الجملة → يرجع مغلقاً (مفتاحه يجب على المستخدم فتحه إذا أراد).
   */
  readonly grammarOpen = linkedSignal({
    source: this.sentence,
    computation: () => false,
  });

  // ───────── computed مساعدة ─────────

  /** هل المستخدم اختار كل الكلمات؟ (لتفعيل زر "تحقق") */
  readonly allWordsSelected = computed(() =>
    this.availableWords().length === 0
  );

  // ───────── الأفعال ─────────

  /** ضغط كلمة من المتاحة → تنتقل لمنطقة الترتيب */
  pickWord(tile: WordTile) {
    if (this.status() !== 'building') return;     // اللعبة انتهت، لا تفعل شيئاً
    this.availableWords.update(arr => arr.filter(t => t !== tile));
    this.selectedWords.update(arr => [...arr, tile]);
    this.status.set('building');                  // أي تغيير يُعيد الحالة لـ "building"
  }

  /** ضغط كلمة من الترتيب → ترجع للمتاحة */
  unpickWord(tile: WordTile) {
    if (this.status() === 'correct') return;      // لا نسمح بالعبث بعد النجاح
    this.selectedWords.update(arr => arr.filter(t => t !== tile));
    this.availableWords.update(arr => [...arr, tile]);
    this.status.set('building');
  }

  /** زر التحقق: نقارن ترتيب المستخدم بالأصل */
  check() {
    const sentence = this.sentence();
    if (!sentence) return;

    // نتحقق بمقارنة الكلمات نصياً
    const userOrder = this.selectedWords().map(t => t.word);
    const correctOrder = sentence.germanWords;

    const isCorrect =
      userOrder.length === correctOrder.length &&
      userOrder.every((w, i) => w === correctOrder[i]);

    this.status.set(isCorrect ? 'correct' : 'wrong');

    // عند النجاح: نسجّل الجملة كمنجزة (يحفظ تلقائياً في localStorage)
    // ⚠️ شرط مهم: لا نسجّلها كمنجزة لو استخدم Help (يجب أن يحاول بنفسه)
    if (isCorrect && !this.helpUsed()) {
      this.progressService.markCompleted(sentence.id);
    }
  }

  /** إعادة المحاولة: نعيد ضبط الكلمات بدون تغيير الجملة */
  reset() {
    const s = this.sentence();
    if (!s) return;
    this.availableWords.set(
      shuffle(s.germanWords.map((word, originalIndex) => ({ word, originalIndex })))
    );
    this.selectedWords.set([]);
    this.status.set('building');
    this.helpUsed.set(false);   // ← reset يلغي أثر Help أيضاً
  }

  /**
   * 🆘 يكشف الإجابة الصحيحة للمستخدم.
   *
   * المنطق:
   *   1. نأخذ الترتيب الصحيح من الجملة (germanWords).
   *   2. نملأ selectedWords بهذا الترتيب.
   *   3. نُفرغ availableWords.
   *   4. نُسجّل helpUsed = true (لمنع markCompleted).
   *   5. نُغيّر status لـ 'correct' (يُظهر الإطار الأخضر).
   */
  showHelp() {
    const s = this.sentence();
    if (!s) return;

    // ننشئ tiles بالترتيب الصحيح بنفس الـ originalIndex
    const correctOrder = s.germanWords.map((word, originalIndex) => ({
      word,
      originalIndex,
    }));

    this.selectedWords.set(correctOrder);
    this.availableWords.set([]);
    this.helpUsed.set(true);
    this.status.set('correct');   // الإطار أخضر، لكن markCompleted لن يُستدعى
  }

  /** يُبدّل حالة فتح/إغلاق قسم Grammar */
  toggleGrammar() {
    this.grammarOpen.update(open => !open);
  }

  /**
   * 🎯 معالج Drag & Drop: يُستدعى عند إفلات كلمة بعد سحبها.
   *
   * @param event يحوي:
   *   - previousIndex: الموقع قبل السحب
   *   - currentIndex: الموقع بعد الإفلات
   *   - item: العنصر نفسه
   *   - container: الـ cdkDropList الذي أُفلت فيه
   *
   * مثال: السحب من الموقع 1 إلى الموقع 3
   *   قبل: [A, B, C, D]
   *   بعد: [A, C, D, B]
   */
  drop(event: CdkDragDrop<WordTile[]>) {
    // لا نسمح بإعادة الترتيب بعد النجاح (تجربة UX أفضل)
    if (this.status() === 'correct') return;

    // نُحدّث الـ signal بـ نسخة جديدة من المصفوفة
    this.selectedWords.update(arr => {
      const copy = [...arr];                                    // نسخة (immutable)
      moveItemInArray(copy, event.previousIndex, event.currentIndex);  // نُحرّك العنصر
      return copy;
    });

    // أي تغيير يُلغي حالة "wrong" السابقة
    if (this.status() === 'wrong') {
      this.status.set('building');
    }
  }

  /**
   * 🔊 يقرأ الجملة الألمانية الصحيحة بصوت عالٍ (TTS).
   * مفيد للمستخدم كي يسمع النطق الصحيح للجملة بأكملها.
   *
   * نقرأ من germanWords (المصدر الموثوق) و ليس من selectedWords،
   * كي ينطق دائماً الجملة الصحيحة حتى لو رتّبها المستخدم خطأً.
   */
  playSentence() {
    const s = this.sentence();
    if (!s) return;
    this.speech.speak(s.germanWords.join(' '));
  }

  /** الانتقال للجملة التالية في نفس المستوى */
  goToNextSentence() {
    const current = this.sentence();
    if (!current) return;

    // كل جمل نفس المستوى
    const sameLevel = this.sentencesService
      .sentences()
      .filter(s => s.level === current.level);

    const currentIdx = sameLevel.findIndex(s => s.id === current.id);
    const next = sameLevel[currentIdx + 1];

    if (next) {
      this.router.navigate(['/practice', next.id]);
    } else {
      // وصلنا لآخر جملة → نرجع لقائمة الجمل
      this.router.navigate(['/levels', current.level, 'sentences']);
    }
  }
}
