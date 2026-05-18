import { Component, computed, inject, input, linkedSignal, numberAttribute } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { TopicsService } from '../../../core/services/topics';
import { TopicSentencesService } from '../../../core/services/topic-sentences';
import { ProgressService } from '../../../core/services/progress';
import { SpeechService } from '../../../core/services/speech';
import { shuffle } from '../../../shared/utils/shuffle';
import { WordTile as WordTileComponent } from '../../../shared/components/word-tile/word-tile';

/** بلاط كلمة (نفس البنية في PracticePage) */
interface WordTile {
  word: string;
  originalIndex: number;
}

type GameStatus = 'building' | 'correct' | 'wrong';

/**
 * صفحة تمرين جملة من موضوع.
 *
 * URL: /topics/:topicId/practice/:sentenceId
 *
 * 🎓 لماذا صفحة منفصلة عن PracticePage؟
 *   - مصدر بيانات مختلف: TopicSentencesService بدل SentencesService
 *   - تنقّل مختلف: Back إلى صفحة الموضوع، Next إلى الجملة التالية في الموضوع
 *   - Open/Closed Principle: لا نُعدّل كود يعمل، نُضيف جديداً
 *
 * 🔄 المنطق الداخلي (status, linkedSignal patterns, drag/drop) متطابق
 *   مع PracticePage. لو احتجنا لاحقاً نخرجه إلى base class أو composable.
 */
@Component({
  selector: 'app-topic-practice-page',
  imports: [RouterLink, WordTileComponent, DragDropModule],
  templateUrl: './topic-practice-page.html',
  styleUrl: './topic-practice-page.scss',
})
export class TopicPracticePage {
  readonly topicId = input.required<string>();
  readonly sentenceId = input.required<number, string>({
    transform: numberAttribute,
  });

  private topicsService = inject(TopicsService);
  private topicSentencesService = inject(TopicSentencesService);
  private progressService = inject(ProgressService);
  private router = inject(Router);
  readonly speech = inject(SpeechService);

  readonly loaded = this.topicSentencesService.loaded;

  /** الموضوع الحالي */
  readonly topic = computed(() => this.topicsService.topicById(this.topicId())());

  /** الجملة الحالية */
  readonly sentence = computed(() => {
    const id = this.sentenceId();
    return this.topicSentencesService.sentenceById(id)();
  });

  /** كل جمل الموضوع — نحتاجها لإيجاد الجملة التالية */
  readonly topicSentences = computed(() =>
    this.topicSentencesService.sentencesByTopic(this.topicId())()
  );

  // ───────── حالة اللعبة (نفس النمط من PracticePage) ─────────

  readonly availableWords = linkedSignal({
    source: this.sentence,
    computation: (s): WordTile[] => {
      if (!s) return [];
      return shuffle(
        s.germanWords.map((word, originalIndex) => ({ word, originalIndex }))
      );
    },
  });

  readonly selectedWords = linkedSignal({
    source: this.sentence,
    computation: (): WordTile[] => [],
  });

  readonly status = linkedSignal({
    source: this.sentence,
    computation: (): GameStatus => 'building',
  });

  readonly helpUsed = linkedSignal({
    source: this.sentence,
    computation: () => false,
  });

  readonly grammarOpen = linkedSignal({
    source: this.sentence,
    computation: () => false,
  });

  readonly allWordsSelected = computed(() => this.availableWords().length === 0);

  // ───────── الأفعال ─────────

  pickWord(tile: WordTile) {
    if (this.status() !== 'building') return;
    this.availableWords.update(arr => arr.filter(t => t !== tile));
    this.selectedWords.update(arr => [...arr, tile]);
    this.status.set('building');
  }

  unpickWord(tile: WordTile) {
    if (this.status() === 'correct') return;
    this.selectedWords.update(arr => arr.filter(t => t !== tile));
    this.availableWords.update(arr => [...arr, tile]);
    this.status.set('building');
  }

  drop(event: CdkDragDrop<WordTile[]>) {
    if (this.status() === 'correct') return;
    this.selectedWords.update(arr => {
      const copy = [...arr];
      moveItemInArray(copy, event.previousIndex, event.currentIndex);
      return copy;
    });
    if (this.status() === 'wrong') this.status.set('building');
  }

  check() {
    const s = this.sentence();
    if (!s) return;
    const userOrder = this.selectedWords().map(t => t.word);
    const correctOrder = s.germanWords;
    const isCorrect =
      userOrder.length === correctOrder.length &&
      userOrder.every((w, i) => w === correctOrder[i]);
    this.status.set(isCorrect ? 'correct' : 'wrong');
    if (isCorrect && !this.helpUsed()) {
      this.progressService.markCompleted(s.id);
    }
  }

  reset() {
    const s = this.sentence();
    if (!s) return;
    this.availableWords.set(
      shuffle(s.germanWords.map((word, originalIndex) => ({ word, originalIndex })))
    );
    this.selectedWords.set([]);
    this.status.set('building');
    this.helpUsed.set(false);
  }

  showHelp() {
    const s = this.sentence();
    if (!s) return;
    const correctOrder = s.germanWords.map((word, originalIndex) => ({
      word,
      originalIndex,
    }));
    this.selectedWords.set(correctOrder);
    this.availableWords.set([]);
    this.helpUsed.set(true);
    this.status.set('correct');
  }

  toggleGrammar() {
    this.grammarOpen.update(open => !open);
  }

  /** 🔊 نطق الجملة الألمانية الصحيحة */
  playSentence() {
    const s = this.sentence();
    if (!s) return;
    this.speech.speak(s.germanWords.join(' '));
  }

  /**
   * الانتقال للجملة التالية ضمن نفس الموضوع.
   * الترتيب: حسب ترتيبها في الـ JSON (وهو A1→B2 بالفعل).
   * عند الوصول للأخيرة → نرجع لصفحة الموضوع.
   */
  goToNextSentence() {
    const current = this.sentence();
    if (!current) return;
    const all = this.topicSentences();
    const idx = all.findIndex(s => s.id === current.id);
    const next = all[idx + 1];
    if (next) {
      this.router.navigate(['/topics', this.topicId(), 'practice', next.id]);
    } else {
      // وصلنا لآخر جملة في الموضوع → نرجع لقائمة جمل الموضوع
      this.router.navigate(['/topics', this.topicId()]);
    }
  }
}
