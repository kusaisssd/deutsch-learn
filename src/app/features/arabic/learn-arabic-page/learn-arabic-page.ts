import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArabicService } from '../../../core/services/arabic';
import { SpeechService } from '../../../core/services/speech';

/**
 * صفحة «تعلم العربية» — للمتحدّث بالألمانية.
 *
 * الواجهة بالألمانية في الأساس (لأن المتعلّم ألماني)، مع نصّ عربي و
 * Transliteration. يستخدم TTS بلغة 'ar-SA' للنطق.
 *
 * ملاحظة: لا يوجد صوت سوري في Web Speech، لذا التشكيلتان (Fusha + Syrisch)
 * تُقرآن بنفس صوت ar-SA — الكلمات السورية صحيحة لكن النبرة فصحى.
 * يمكن لاحقاً إضافة ملفات mp3 لتسجيلات أصيلة.
 */
@Component({
  selector: 'app-learn-arabic-page',
  imports: [RouterLink],
  templateUrl: './learn-arabic-page.html',
})
export class LearnArabicPage {
  private arabic = inject(ArabicService);
  readonly speech = inject(SpeechService);

  readonly loaded = this.arabic.loaded;
  readonly categories = this.arabic.categories;
  readonly pronunciationKey = this.arabic.pronunciationKey;

  /** القسم المُحدَّد (null = عرض شبكة الأقسام) */
  readonly selectedId = signal<string | null>(null);
  readonly selected = computed(() => {
    const id = this.selectedId();
    return id ? this.categories().find(c => c.id === id) ?? null : null;
  });

  open(id: string) { this.selectedId.set(id); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  close() { this.selectedId.set(null); }

  /** نطق نص عربي بـ ar-SA (الوحيد المتاح في المتصفّحات) */
  speakAr(text: string) {
    this.speech.speak(text, 0.9, undefined, 'ar-SA');
  }
}
