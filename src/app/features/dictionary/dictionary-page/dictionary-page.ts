import { Component, computed, inject, signal } from '@angular/core';
import { DictionaryService } from '../../../core/services/dictionary';
import { SpeechService } from '../../../core/services/speech';

/**
 * صفحة القاموس.
 *
 * يكتب المستخدم كلمة ألمانية فيحصل على:
 *   - إن كانت اسماً: der/die/das + جدول الحالات الأربع (مفرد/جمع) + أمثلة.
 *   - إن كانت فعلاً: تصريف الضمائر في الحاضر و الماضي و الـ Perfekt.
 *
 * البيانات تُحمَّل مرّة واحدة (lazy) ثم تعمل offline.
 */
@Component({
  selector: 'app-dictionary-page',
  imports: [],
  templateUrl: './dictionary-page.html',
})
export class DictionaryPage {
  private dict = inject(DictionaryService);
  readonly speech = inject(SpeechService);

  readonly loading = this.dict.loading;
  readonly error = this.dict.error;
  readonly ready = this.dict.ready;

  /** النص في صندوق البحث */
  readonly query = signal('');
  /** آخر كلمة تمّ البحث عنها فعلياً (عند الضغط) */
  readonly submitted = signal('');

  /** نتيجة البحث (تتحدّث تلقائياً عند جاهزية البيانات) */
  readonly result = computed(() => {
    const q = this.submitted();
    if (!q) return null;
    return this.dict.lookup(q);
  });

  /** هل بحثنا و لم نجد شيئاً؟ */
  readonly notFound = computed(() => {
    const r = this.result();
    return r != null && !r.noun && !r.verb;
  });

  search(): void {
    this.submitted.set(this.query().trim());
  }

  onInput(value: string): void {
    this.query.set(value);
  }

  retry(): void {
    this.dict.retry();
  }

  speak(text: string): void {
    this.speech.speak(text);
  }
}
