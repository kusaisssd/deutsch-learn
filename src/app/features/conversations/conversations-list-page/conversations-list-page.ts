import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConversationsService } from '../../../core/services/conversations';
import { ProgressService } from '../../../core/services/progress';
import { Conversation } from '../../../core/models/conversation.model';

/**
 * صفحة قائمة المحادثات — تجميع حسب السياق + فصل بين منجزة/غير منجزة.
 *
 * نُعيد تنظيم البيانات في computed signal بحيث يستخدم الـ template
 * بنية جاهزة (incomplete vs completed) بدون منطق تجميع في الـ HTML.
 */
@Component({
  selector: 'app-conversations-list-page',
  imports: [RouterLink],
  templateUrl: './conversations-list-page.html',
  styleUrl: './conversations-list-page.scss',
})
export class ConversationsListPage {
  private conversationsService = inject(ConversationsService);
  private progressService = inject(ProgressService);

  readonly loaded = this.conversationsService.loaded;

  /**
   * نسخة مُحسَّنة من groups: كل group فيه قائمتان منفصلتان:
   *   - incomplete: غير منجزة (تظهر أولاً)
   *   - completed:  منجزة (تظهر بعد فاصل)
   *
   * computed يُعاد حسابه تلقائياً عند:
   *   - تحميل المحادثات
   *   - تغيّر التقدم (نجح في محادثة جديدة)
   */
  readonly sortedGroups = computed(() => {
    const completed = this.progressService.completedConversationIds();
    return this.conversationsService.grouped().map(group => {
      const incomplete: Conversation[] = [];
      const done: Conversation[] = [];
      for (const conv of group.conversations) {
        if (completed.has(conv.id)) {
          done.push(conv);
        } else {
          incomplete.push(conv);
        }
      }
      return {
        context: group.context,
        contextEmoji: group.contextEmoji,
        contextTitle: group.contextTitle,
        total: group.conversations.length,
        completedCount: done.length,
        incomplete,
        completed: done,
      };
    });
  });
}
