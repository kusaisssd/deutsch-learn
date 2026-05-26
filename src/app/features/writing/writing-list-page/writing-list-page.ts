import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WritingService } from '../../../core/services/writing';

/**
 * صفحة قسم الكتابة (Schreiben).
 *
 * تعرض:
 *   1) دليل الترابط (أدوات الربط مصنّفة) — قابل للطيّ.
 *   2) تمارين الكتابة مُجمَّعة حسب النوع (رأي / قصة / رسم بياني)
 *      مع شارة «منجز» لكل تمرين أكمله المستخدم.
 */
@Component({
  selector: 'app-writing-list-page',
  imports: [RouterLink],
  templateUrl: './writing-list-page.html',
})
export class WritingListPage {
  private writing = inject(WritingService);

  readonly loaded = this.writing.loaded;
  readonly guide = this.writing.guide;

  /** عناوين أقسام الأنواع (بالعربي) + الإيموجي */
  readonly kindMeta: Record<string, { label: string; emoji: string; hint: string }> = {
    opinion: { label: 'مواضيع الرأي', emoji: '🗣️', hint: 'عبّر عن رأيك بحجج مع و ضد، ثم استنتاج.' },
    story: { label: 'قصص و سرد', emoji: '📖', hint: 'احكِ حدثاً في الماضي بترتيب زمني مترابط.' },
    graph: { label: 'وصف رسوم بيانية', emoji: '📊', hint: 'صف أرقاماً و قارن بينها بموضوعية.' },
  };

  readonly kinds = ['opinion', 'story', 'graph'] as const;

  /** التمارين مُجمَّعة حسب النوع */
  readonly groups = this.writing.tasksByKind;

  /** عدد المنجز / الإجمالي (لشريط بسيط) */
  readonly stats = computed(() => {
    const tasks = this.writing.tasks();
    const done = tasks.filter(t => this.writing.isDone(t.id)).length;
    return { done, total: tasks.length };
  });

  isDone(id: string): boolean {
    return this.writing.isDone(id);
  }
}
