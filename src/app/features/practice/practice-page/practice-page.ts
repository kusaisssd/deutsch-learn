import { Component, computed, inject, input, linkedSignal, numberAttribute } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SentencesService } from '../../../core/services/sentences';
import { ProgressService } from '../../../core/services/progress';
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
  imports: [RouterLink, WordTileComponent],
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
    if (isCorrect) {
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
