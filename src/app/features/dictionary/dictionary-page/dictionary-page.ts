import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { DictionaryService } from '../../../core/services/dictionary';
import { SpeechService } from '../../../core/services/speech';

/**
 * صفحة القاموس.
 *
 * يكتب المستخدم كلمة ألمانية فيحصل على:
 *   - إن كانت اسماً: der/die/das + جدول الحالات الأربع (مفرد/جمع) + أمثلة.
 *   - إن كانت فعلاً: تصريف الضمائر في الحاضر و الماضي و الـ Perfekt.
 *   - ترجمة عربية (تُجلب online مرّة ثم تُخبّأ).
 *   - اقتراحات «هل تقصد؟» عند الخطأ الإملائي (offline).
 *
 * البيانات الصرفية تُحمَّل مرّة واحدة (lazy) ثم تعمل offline.
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

  readonly query = signal('');
  readonly submitted = signal('');

  readonly result = computed(() => {
    const q = this.submitted();
    if (!q) return null;
    return this.dict.lookup(q);
  });

  readonly notFound = computed(() => {
    const r = this.result();
    return r != null && !r.noun && !r.verb;
  });

  /** اقتراحات إملائية عند عدم العثور على الكلمة */
  readonly suggestions = computed(() => {
    if (!this.notFound()) return [];
    return this.dict.suggest(this.submitted());
  });

  constructor() {
    // عند ظهور نتيجة: اطلب الترجمة العربية و سجّل الكلمة في الذاكرة.
    // untracked: حتى لا تُعاد بسبب كتابة إشارات الترجمة، بل عند تغيّر النتيجة فقط.
    effect(() => {
      const r = this.result();
      if (!r) return;
      untracked(() => {
        if (r.noun) {
          this.dict.translate(r.noun.word);
          this.dict.record({ word: r.noun.word, kind: 'noun', article: r.noun.article, gender: r.noun.gender });
        }
        if (r.verb) {
          this.dict.translate(r.verb.infinitive);
          this.dict.record({ word: r.verb.infinitive, kind: 'verb' });
        }
      });
    });
  }

  // ───────── روابط غوغل (صور + أمثلة) ─────────

  /** بحث صور غوغل عن الكلمة (للأسماء: الأداة + الكلمة لدقّة أعلى) */
  googleImages(word: string): string {
    return 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(word);
  }

  /**
   * أمثلة واقعية مع ترجمة عربية لكل جملة عبر Reverso Context (ألماني→عربي).
   * أفضل من بحث غوغل العام: كل جملة مثال مقترنة بترجمتها العربية مباشرةً.
   */
  reversoExamples(word: string): string {
    return 'https://context.reverso.net/translation/german-arabic/' + encodeURIComponent(word);
  }

  search(): void {
    this.submitted.set(this.query().trim());
  }

  /** بحث مباشر عن كلمة (من رقاقة اقتراح) */
  searchWord(word: string): void {
    this.query.set(word);
    this.submitted.set(word);
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

  // ───────── الترجمة (تمرير للقالب) ─────────
  translationOf(word: string): string | undefined {
    return this.dict.translationOf(word);
  }
  isTranslating(word: string): boolean {
    return this.dict.isTranslating(word);
  }
  translationFailed(word: string): boolean {
    return this.dict.translationFailed(word);
  }
}
