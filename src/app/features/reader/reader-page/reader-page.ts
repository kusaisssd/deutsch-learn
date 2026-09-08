import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SpeechService } from '../../../core/services/speech';
import { TranslationService, TargetLang } from '../../../core/services/translation';
import { NewsService } from '../../../core/services/news';
import { DictionaryService } from '../../../core/services/dictionary';
import { ClaudeLookupService } from '../../../core/services/claude-lookup';

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
  private dict = inject(DictionaryService);
  protected claude = inject(ClaudeLookupService);

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

  /** مدى الكلمات المُختارة (لدعم عبارة متعدّدة الكلمات) — start و end فهرسان ضمن tokens() */
  readonly selectedRange = signal<{ start: number; end: number } | null>(null);

  /** النصّ المُختار (كلمة واحدة أو عبارة كاملة) */
  readonly selectedText = computed<string>(() => {
    const r = this.selectedRange();
    const toks = this.tokens();
    if (!r || !toks.length) return this.selectedToken()?.text ?? '';
    return toks.slice(r.start, r.end + 1).map(t => t.text).join('').trim();
  });

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

  /** حالات إضافيّة للـ popup الموحّد */
  readonly addedToDict = signal(false);
  readonly aiExplanation = signal<string>('');
  readonly aiLoading = signal(false);
  readonly aiError = signal<string | null>(null);

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
    // Shift+click على كلمة أخرى → توسيع المدى بدل استبدال الاختيار
    if (event?.shiftKey && this.selectedRange()) {
      this.extendSelectionTo(token.index);
      return;
    }

    // إعادة النقر على نفس الكلمة (بلا Shift) → إغلاق
    const cur = this.selectedRange();
    if (cur && cur.start === token.index && cur.end === token.index) {
      this.closePopup();
      return;
    }

    this.selectedToken.set(token);
    this.selectedRange.set({ start: token.index, end: token.index });

    if (event && event.currentTarget instanceof HTMLElement) {
      this.clickedWordRect.set(event.currentTarget.getBoundingClientRect());
    }

    this.refetchTranslations();
  }

  /** يوسّع المدى ليشمل حتى الفهرس المُعطى (يمين أو يسار) */
  extendSelectionTo(index: number): void {
    const r = this.selectedRange();
    if (!r) return;
    const start = Math.min(r.start, index);
    const end = Math.max(r.end, index);
    this.selectedRange.set({ start, end });
    // حدّث المستطيل ليشمل الكلمات المُختارة كلّها
    this.recomputeSelectionRect();
    this.refetchTranslations();
  }

  /** يوسّع بكلمة واحدة يميناً (كلمة لاحقة في النصّ) */
  extendRight(): void {
    const r = this.selectedRange();
    const toks = this.tokens();
    if (!r) return;
    // اقفز فوق أي علامات ترقيم/مسافات لأقرب كلمة بعد end
    for (let i = r.end + 1; i < toks.length; i++) {
      if (toks[i].isWord) { this.extendSelectionTo(i); return; }
    }
  }

  /** يوسّع بكلمة واحدة يساراً (كلمة سابقة) */
  extendLeft(): void {
    const r = this.selectedRange();
    const toks = this.tokens();
    if (!r) return;
    for (let i = r.start - 1; i >= 0; i--) {
      if (toks[i].isWord) { this.extendSelectionTo(i); return; }
    }
  }

  private recomputeSelectionRect(): void {
    const r = this.selectedRange();
    if (!r) return;
    // اجمع مستطيلات كل الكلمات في المدى
    const nodes = document.querySelectorAll<HTMLElement>('[data-reader-token]');
    let combined: DOMRect | null = null;
    nodes.forEach((el) => {
      const idx = Number(el.dataset['readerToken']);
      if (isNaN(idx) || idx < r.start || idx > r.end) return;
      const box = el.getBoundingClientRect();
      if (!combined) {
        combined = box;
      } else {
        const left = Math.min(combined.left, box.left);
        const top = Math.min(combined.top, box.top);
        const right = Math.max(combined.right, box.right);
        const bottom = Math.max(combined.bottom, box.bottom);
        combined = new DOMRect(left, top, right - left, bottom - top);
      }
    });
    if (combined) this.clickedWordRect.set(combined);
  }

  private refetchTranslations(): void {
    const text = this.selectedText();
    if (!text) return;
    this.arabicTranslation.set({ loading: true, meanings: [] });
    this.englishTranslation.set({ loading: true, meanings: [] });
    this.addedToDict.set(false);
    this.aiExplanation.set('');
    this.aiError.set(null);

    this.translation.translateMany(text, 'ar').subscribe(meanings => {
      this.arabicTranslation.set({ loading: false, meanings });
    });
    this.translation.translateMany(text, 'en').subscribe(meanings => {
      this.englishTranslation.set({ loading: false, meanings });
    });
  }

  /** يضيف الكلمة/العبارة المختارة إلى القاموس */
  addToDictionary(): void {
    const text = this.selectedText();
    if (!text) return;
    const ar = this.arabicTranslation().meanings[0];
    const kind: 'phrase' | 'verb' = text.includes(' ') ? 'phrase' : 'phrase';
    this.dict.record({
      word: text,
      kind,
      translation: ar,
    });
    this.addedToDict.set(true);
  }

  /** يسأل Claude عن الكلمة/العبارة المختارة و يعرض الجواب داخل الـ popup */
  async askAI(): Promise<void> {
    const text = this.selectedText();
    if (!text) return;
    if (!this.claude.available()) {
      this.aiError.set('اضبط passphrase أوّلاً من صفحة إعدادات القاموس.');
      return;
    }
    this.aiLoading.set(true);
    this.aiError.set(null);
    try {
      const prompt = text.includes(' ')
        ? `اشرح لي هذه العبارة الألمانية في سياق الجملة، و أعطني ترجمة عربية دقيقة مع بديل واحد إن كان لها معنى اصطلاحي.`
        : `اشرح لي هذه الكلمة الألمانية باختصار، مع ترجمتها العربية و مثال واحد لاستخدامها.`;
      const answer = await this.claude.ask(text, prompt);
      if (answer) {
        this.aiExplanation.set(answer);
        // احفظ الجواب في القاموس أيضاً (يُنشئ مدخلاً إن لم يكن موجوداً)
        this.dict.appendAsk(text, text.includes(' ') ? 'phrase' : 'phrase', {
          q: prompt, a: answer, preset: 'reader',
        });
      } else {
        this.aiError.set('تعذّر الحصول على جواب.');
      }
    } finally {
      this.aiLoading.set(false);
    }
  }

  /** نطق النصّ المختار (كلمة أو عبارة) */
  speakSelected(): void {
    const text = this.selectedText();
    if (!text) return;
    this.speech.speak(text, this.speechRate());
  }

  /** إغلاق الـ popup (يمسح أيضاً موقع و مدى الاختيار) */
  closePopup(): void {
    this.selectedToken.set(null);
    this.selectedRange.set(null);
    this.clickedWordRect.set(null);
    this.aiExplanation.set('');
    this.aiError.set(null);
    this.addedToDict.set(false);
  }

  /** هل الفهرس المُعطى ضمن المدى المُختار حاليّاً؟ (للتلوين) */
  isInSelection(index: number): boolean {
    const r = this.selectedRange();
    return !!r && index >= r.start && index <= r.end;
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
