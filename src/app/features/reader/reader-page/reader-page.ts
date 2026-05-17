import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SpeechService } from '../../../core/services/speech';
import { TranslationService, TargetLang } from '../../../core/services/translation';
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
 * نتيجة ترجمة كلمة مع كل معانيها البديلة.
 *   - loading: هل جلب جارٍ؟
 *   - meanings: مصفوفة الترجمات (قد تكون [] إذا فشل أو خالية)
 *
 * 🆕 غيّرنا من text:string إلى meanings:string[] لدعم
 *   عدة معاني لكل كلمة (Bank = bank/bench/shore).
 */
interface TranslationState {
  loading: boolean;
  meanings: string[];
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

  /**
   * 🆕 موقع الكلمة المضغوطة على الشاشة (نستخدمه لوضع الـ popup قربها على الموبايل).
   * null = لم تُضغط كلمة، أو نحن في وضع desktop (لا نحتاج).
   *
   * DOMRect فيه: top, left, right, bottom, width, height
   * بالنسبة للـ viewport (لذلك يعمل مع position: fixed).
   */
  readonly clickedWordRect = signal<DOMRect | null>(null);

  /**
   * 🎯 موقع و مكان الـ floating popup على الموبايل.
   *
   * الخوارزمية:
   *   - عمودياً: نضعه أسفل الكلمة لو فيه مساحة، فوقها لو لا
   *   - أفقياً: مركَّز على الكلمة، مقيَّد بحواف الشاشة
   *
   * computed يُعاد حسابه تلقائياً عند تغيّر clickedWordRect.
   *
   * يُرجع null لو لا يوجد rect (لا popup يُعرض).
   */
  readonly popupPosition = computed<{ top: number; left: number; placement: 'above' | 'below' } | null>(() => {
    const rect = this.clickedWordRect();
    if (!rect) return null;

    // ثوابت التصميم
    const POPUP_W = 300;          // العرض المقدَّر للـ popup
    const POPUP_EST_H = 220;      // الارتفاع المقدَّر (قبل render)
    const GAP = 8;                // مسافة بين الكلمة و الـ popup
    const MARGIN = 8;             // هامش من حواف الشاشة

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // قرار عمودي: فوق أم تحت؟
    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;
    const placeBelow = spaceBelow >= POPUP_EST_H || spaceBelow >= spaceAbove;
    const top = placeBelow
      ? rect.bottom + GAP
      : Math.max(MARGIN, rect.top - POPUP_EST_H - GAP);

    // قرار أفقي: مركَّز على الكلمة، مقيَّد بالشاشة
    const centerX = rect.left + rect.width / 2;
    let left = centerX - POPUP_W / 2;
    left = Math.max(MARGIN, Math.min(left, vw - POPUP_W - MARGIN));

    return {
      top: Math.round(top),
      left: Math.round(left),
      placement: placeBelow ? 'below' : 'above',
    };
  });

  /** ترجمات الكلمة المختارة (مع كل معانيها البديلة) */
  readonly arabicTranslation = signal<TranslationState>({ loading: false, meanings: [] });
  readonly englishTranslation = signal<TranslationState>({ loading: false, meanings: [] });

  /** حالة جلب الأخبار من heise.de */
  readonly newsLoading = signal<boolean>(false);
  readonly newsError = signal<string | null>(null);

  // ───────── 🆕 Full-text translation state ─────────

  /** اللغة الهدف للترجمة الكاملة (en افتراضياً، يُمكن تغييرها) */
  readonly fullTranslationLang = signal<TargetLang>('en');

  /** النص المترجم الكامل */
  readonly fullTranslation = signal<string>('');

  /** هل الترجمة جارية؟ */
  readonly fullTranslationLoading = signal<boolean>(false);

  /** رسالة خطأ إن فشل الطلب */
  readonly fullTranslationError = signal<string | null>(null);

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
  /**
   * المستخدم نقر كلمة.
   *
   * @param token الكلمة (نص + index)
   * @param event حدث الضغط — نستخدمه لمعرفة موقع العنصر على الشاشة
   *              (لوضع الـ popup قربها على الموبايل).
   */
  selectWord(token: TextToken, event?: MouseEvent): void {
    // لو نقر على نفس الكلمة → نُغلق الـ popup
    if (this.selectedToken()?.index === token.index) {
      this.closePopup();
      return;
    }

    this.selectedToken.set(token);

    // 🆕 احفظ موقع العنصر المضغوط (للـ floating popup على الموبايل)
    if (event && event.currentTarget instanceof HTMLElement) {
      this.clickedWordRect.set(event.currentTarget.getBoundingClientRect());
    }

    // نعيد ضبط الحالة و نضع loading
    this.arabicTranslation.set({ loading: true, meanings: [] });
    this.englishTranslation.set({ loading: true, meanings: [] });

    // translateMany لجلب كل المعاني
    this.translation.translateMany(token.text, 'ar').subscribe(meanings => {
      this.arabicTranslation.set({ loading: false, meanings });
    });

    this.translation.translateMany(token.text, 'en').subscribe(meanings => {
      this.englishTranslation.set({ loading: false, meanings });
    });
  }

  /** نطق الكلمة المختارة منفردة */
  speakSelected(): void {
    const t = this.selectedToken();
    if (!t) return;
    this.speech.speak(t.text, this.speechRate());
  }

  /** إغلاق الـ popup (يمسح أيضاً موقع الكلمة) */
  closePopup(): void {
    this.selectedToken.set(null);
    this.clickedWordRect.set(null);
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

  // ───────── 🆕 Full-text translation actions ─────────

  /**
   * 🌐 يترجم كل النص الموجود في الـ textarea للغة المختارة.
   *
   * يستخدم translate() (الترجمة الواحدة) لأن النصوص الطويلة
   * نحتاج لها ترجمة سياقية، ليس قائمة معاني.
   */
  translateFullText(): void {
    const text = this.inputText().trim();
    if (!text) {
      this.fullTranslationError.set('Nothing to translate — paste some German text first.');
      return;
    }

    this.fullTranslationLoading.set(true);
    this.fullTranslationError.set(null);

    this.translation.translate(text, this.fullTranslationLang()).subscribe({
      next: (translated) => {
        this.fullTranslation.set(translated);
        this.fullTranslationLoading.set(false);
      },
      error: (err) => {
        console.error('Full translation failed:', err);
        this.fullTranslationError.set('Translation failed. Please try again.');
        this.fullTranslationLoading.set(false);
      },
    });
  }

  /** يُغيّر اللغة الهدف و يمسح الترجمة القديمة. */
  setTranslationLang(lang: TargetLang): void {
    if (this.fullTranslationLang() === lang) return;
    this.fullTranslationLang.set(lang);
    this.fullTranslation.set('');
    this.fullTranslationError.set(null);
  }

  /** يمسح الترجمة الكاملة (لزر الإغلاق على الـ panel). */
  clearFullTranslation(): void {
    this.fullTranslation.set('');
    this.fullTranslationError.set(null);
  }
}
