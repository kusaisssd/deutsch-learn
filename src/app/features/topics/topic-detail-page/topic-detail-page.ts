import { Component, computed, inject, input, linkedSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TopicsService } from '../../../core/services/topics';
import { TopicSentencesService } from '../../../core/services/topic-sentences';
import { ProgressService } from '../../../core/services/progress';
import { LevelCode } from '../../../core/models/level.model';

/**
 * صفحة تفاصيل موضوع واحد.
 *
 * مثال URL: /topics/pronouns
 *           → topicId = 'pronouns'
 *
 * تعرض:
 *   - رأس الموضوع (emoji + عنوان + وصف)
 *   - قسم Grammar Overview قابل للطي
 *   - جمل الموضوع مجمعة حسب المستوى (A1, A2, B1, B2)
 *   - كل جملة بطاقة قابلة للضغط → /topics/:id/practice/:sentenceId
 *
 * 🎓 ملاحظة معمارية:
 *   يستخدم linkedSignal لحالة "هل القسم النحوي مفتوح؟"
 *   كي يُعاد لـ "مفتوح" كلما تغيّر الموضوع (المستخدم انتقل لموضوع آخر).
 *   نفس النمط المستخدم في ConversationPlayerPage مع 'descriptionOpen'.
 */
@Component({
  selector: 'app-topic-detail-page',
  imports: [RouterLink],
  templateUrl: './topic-detail-page.html',
  styleUrl: './topic-detail-page.scss',
})
export class TopicDetailPage {
  /** يُمرّر تلقائياً من الـ URL بفضل withComponentInputBinding() */
  readonly topicId = input.required<string>();

  private topicsService = inject(TopicsService);
  private topicSentencesService = inject(TopicSentencesService);
  private progressService = inject(ProgressService);

  readonly loaded = this.topicSentencesService.loaded;
  readonly completedIds = this.progressService.completedIds;

  /** الموضوع الحالي */
  readonly topic = computed(() => this.topicsService.topicById(this.topicId())());

  /** جمل الموضوع مُجمَّعة حسب المستوى */
  readonly sentencesByLevel = computed(() =>
    this.topicSentencesService.sentencesByTopicGroupedByLevel(this.topicId())()
  );

  /** كل المستويات بالترتيب (لـ template) */
  readonly levels: LevelCode[] = ['A1', 'A2', 'B1', 'B2'];

  /** عدد كل الجمل في هذا الموضوع */
  readonly totalCount = computed(() => {
    const byLevel = this.sentencesByLevel();
    return this.levels.reduce((sum, lvl) => sum + byLevel[lvl].length, 0);
  });

  /** عدد المنجز */
  readonly doneCount = computed(() => {
    const byLevel = this.sentencesByLevel();
    const allIds = this.levels.flatMap(lvl => byLevel[lvl].map(s => s.id));
    return this.progressService.countCompletedAmong(allIds);
  });

  /**
   * 🎯 حالة فتح قسم Grammar Overview.
   * linkedSignal بالصيغة الصريحة: يُعاد لـ true كلما تغيّر الموضوع.
   * (نفس الـ pattern المستخدم في ConversationPlayerPage.descriptionOpen)
   */
  readonly grammarOpen = linkedSignal({
    source: this.topic,
    computation: () => true,
  });

  toggleGrammar() {
    this.grammarOpen.update(open => !open);
  }
}
