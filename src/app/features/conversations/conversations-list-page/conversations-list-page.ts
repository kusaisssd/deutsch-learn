import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConversationsService } from '../../../core/services/conversations';

/**
 * صفحة قائمة المحادثات.
 *
 * تستخدم computed signal `grouped` من الـ service مباشرة —
 * نمط نظيف لأن المنطق في مكان واحد (الـ service).
 *
 * مقابل في .NET MVC:
 *   Controller يستدعي Repository.GetGroupedConversations()
 *   و يمرّر النتيجة لـ View.
 */
@Component({
  selector: 'app-conversations-list-page',
  imports: [RouterLink],
  templateUrl: './conversations-list-page.html',
  styleUrl: './conversations-list-page.scss',
})
export class ConversationsListPage {
  private conversationsService = inject(ConversationsService);

  /** تعريض الـ signals للـ template */
  readonly loaded = this.conversationsService.loaded;
  readonly groups = this.conversationsService.grouped;
}
