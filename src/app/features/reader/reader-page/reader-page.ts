import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SpeechService } from '../../../core/services/speech';
import { TranslationService } from '../../../core/services/translation';
import { NewsService } from '../../../core/services/news';

/**
 * تمثيل token (كلمة أو علامة ترقيم) داخل النص.
 * نحتاج التمييز لأن علامات الترقيم لا تكون قابلة للنقر.
 */
interface TextToken {
  text: string;
  isWord: boolean;       // كلمة (قابلة للنقر) أم علامة ترقيم/مسافة؟
  index: number;         // ترتيبها (للـ track في @for)
}

/**
 * نتيجة الترجمة لكلمة مختارة.
 * نخزّن حالة كل ترجمة على حدة (loading / value / error).
 */
interface TranslationState {
  loading: boolean;
  text: string;
}

/**
 * ReaderPage — صفحة قراءة نص ألماني مع ميزات تفاعلية.
 *
 * الميزات:
 *   - لصق نص ألماني (textarea)
 *   - زر "اقرأ كل النص" مع التحكم بالسرعة (0.5x - 2x)
 *   - النص يظهر بكلمات قابلة للنقر
 *   - نقر على كلمة → popup يظهر تحتها:
 *       🔊 نطق منفرد
 *       🇸🇦 ترجمة عربية
 *       🇬🇧 ترجمة إنجليزية
 *
 * مفاهيم جديدة هنا:
 *   - FormsModule + [(ngModel)] للربط الثنائي مع textarea و slider
 *   - استدعاء Observable من service و subscribe
 *   - إدارة state UI معقدة (الكلمة المختارة، الترجمات)
 */
@Component({
  selector: 'app-reader-page',
  imports: [FormsModule],
  templateUrl: './reader-page.html',
  styleUrl: './reader-page.scss',
})
export class ReaderPage {
  // ───────── Services ─────────
  protected speech = inject(SpeechService);
  private translation = inject(TranslationService);
  private news = inject(NewsService);

  // ───────── State ─────────

  /**
   * النص المدخل من المستخدم.
   * نستخدم signal كي تتحدث الواجهة عند التغيير.
   * [(ngModel)] في الـ HTML سيقرأ و يكتب على هذا الـ signal.
   */
  readonly inputText = signal<string>(
    // نص تجريبي افتراضي
    'Hallo! Ich heiße Anna. Ich wohne in Berlin und ich lerne Deutsch. Heute ist das Wetter sehr schön. Ich gehe in den Park mit meinen Freunden.'
  );

  /** سرعة القراءة (0.5 - 2.0) */
  readonly speechRate = signal<number>(1.0);

  /** الكلمة المختارة حالياً (للـ popup). null = لا شيء مختار */
  readonly selectedToken = signal<TextToken | null>(null);

  /** ترجمات الكلمة المختارة */
  readonly arabicTranslation = signal<TranslationState>({ loading: false, text: '' });
  readonly englishTranslation = signal<TranslationState>({ loading: false, text: '' });

  /** حالة جلب الأخبار من heise.de */
  readonly newsLoading = signal<boolean>(false);
  readonly newsError = signal<string | null>(null);

  // ───────── Computed ─────────

  /**
   * تحويل النص إلى tokens.
   * نستخدم regex يحفظ علامات الترقيم كـ tokens منفصلة.
   *
   * مثال: "Hallo, Welt!" → [
   *   { text: 'Hallo', isWord: true,  index: 0 },
   *   { text: ',',     isWord: false, index: 1 },
   *   { text: ' ',     isWord: false, index: 2 },
   *   { text: 'Welt',  isWord: true,  index: 3 },
   *   { text: '!',     isWord: false, index: 4 },
   * ]
   *
   * computed = يُعاد حسابه تلقائياً لما يتغيّر inputText.
   */
  readonly tokens = computed<TextToken[]>(() => {
    const text = this.inputText();
    if (!text) return [];

    // regex: نلتقط الكلمات (أحرف unicode) أو أي شيء آخر (مسافات/ترقيم)
    const matches = text.match(/[\p{L}\p{M}]+|[^\p{L}\p{M}]+/gu) ?? [];

    return matches.map((piece, index) => ({
      text: piece,
      isWord: /[\p{L}]/u.test(piece),
      index,
    }));
  });

  // ───────── Actions ─────────

  /** قراءة كل النص بالسرعة المحددة */
  readAll(): void {
    this.speech.speak(this.inputText(), this.speechRate());
  }

  /** إيقاف القراءة */
  stopReading(): void {
    this.speech.stop();
  }

  /**
   * المستخدم نقر على كلمة.
   * - نحفظها كـ selected
   * - نطلب الترجمات للعربي و الإنجليزي بالتوازي
   * - الـ popup يظهر تلقائياً (يعتمد على selectedToken في القالب)
   */
  selectWord(token: TextToken): void {
    // لو نقر على نفس الكلمة → نُغلق الـ popup
    if (this.selectedToken()?.index === token.index) {
      this.closePopup();
      return;
    }

    this.selectedToken.set(token);

    // نعيد ضبط الحالة و نضع loading
    this.arabicTranslation.set({ loading: true, text: '' });
    this.englishTranslation.set({ loading: true, text: '' });

    // طلب الترجمتين بالتوازي
    this.translation.translate(token.text, 'ar').subscribe(text => {
      this.arabicTranslation.set({ loading: false, text });
    });

    this.translation.translate(token.text, 'en').subscribe(text => {
      this.englishTranslation.set({ loading: false, text });
    });
  }

  /** نطق الكلمة المختارة منفردة */
  speakSelected(): void {
    const t = this.selectedToken();
    if (!t) return;
    this.speech.speak(t.text, this.speechRate());
  }

  /** إغلاق الـ popup */
  closePopup(): void {
    this.selectedToken.set(null);
  }

  /** تحديث السرعة من الـ slider — نأخذ الحدث و نُخرج الرقم */
  onRateChange(event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    this.speechRate.set(value);
  }

  /**
   * 📰 يجلب مقالاً تقنياً عشوائياً من heise.de و يضعه في الـ textarea.
   *
   * 🎯 Flow:
   *   1. نضع loading = true (يظهر spinner على الزر)
   *   2. نطلب آخر 10 مقالات
   *   3. نختار واحداً عشوائياً
   *   4. نُكوّن نصاً من العنوان + الوصف
   *   5. نضعه في inputText (الـ textarea يتحدّث تلقائياً عبر [(ngModel)])
   *   6. نُغلق الـ popup إن كان مفتوحاً
   */
  loadRandomNews(): void {
    this.newsLoading.set(true);
    this.newsError.set(null);
    this.closePopup();

    this.news.fetchLatest().subscribe({
      next: (articles) => {
        if (articles.length === 0) {
          this.newsError.set('No news available right now.');
          this.newsLoading.set(false);
          return;
        }
        // اختيار عشوائي
        const random = articles[Math.floor(Math.random() * articles.length)];
        // تركيب نص للعرض: العنوان + سطر فارغ + الوصف
        const text = `${random.title}\n\n${random.description}`;
        this.inputText.set(text);
        this.newsLoading.set(false);
      },
      error: (err) => {
        console.error('News fetch failed:', err);
        this.newsError.set('Failed to load news. Check your internet connection.');
        this.newsLoading.set(false);
      },
    });
  }
}
