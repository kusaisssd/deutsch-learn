import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TopicsService } from '../../../core/services/topics';
import { TopicSentencesService } from '../../../core/services/topic-sentences';
import { ProgressService } from '../../../core/services/progress';

/**
 * صفحة قائمة المواضيع.
 *
 * 🎯 مهمتها:
 *   - عرض شبكة من بطاقات المواضيع
 *   - كل بطاقة: emoji + عنوان + وصف + عدد الجمل + تقدّم المستخدم
 *   - ضغطة → /topics/:id
 *
 * 🎓 مفاهيم متكرّرة:
 *   - inject() للحقن
 *   - computed لتجميع الإحصائيات (تشبه LevelsPage)
 */
@Component({
  selector: 'app-topics-list-page',
  imports: [RouterLink],
  templateUrl: './topics-list-page.html',
  styleUrl: './topics-list-page.scss',
})
export class TopicsListPage {
  private topicsService = inject(TopicsService);
  private topicSentencesService = inject(TopicSentencesService);
  private progressService = inject(ProgressService);

  readonly topics = this.topicsService.topics;
  readonly loaded = this.topicSentencesService.loaded;

  /**
   * إحصائيات لكل موضوع: { topicId: { done, total } }.
   *
   * يعتمد على:
   *   - بيانات المواضيع (sentencesByTopic لكل موضوع)
   *   - تقدّم المستخدم (completedIds من ProgressService)
   *
   * نمشي على المواضيع و نعد لكل واحد كم جملة أكملها المستخدم.
   */
  readonly statsByTopic = computed(() => {
    const stats: Record<string, { done: number; total: number }> = {};
    for (const topic of this.topics()) {
      const sentences = this.topicSentencesService.sentencesByTopic(topic.id)();
      stats[topic.id] = {
        total: sentences.length,
        done: this.progressService.countCompletedAmong(
          sentences.map(s => s.id)
        ),
      };
    }
    return stats;
  });
}
