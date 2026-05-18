import { Component, computed, DestroyRef, HostListener, inject, input, linkedSignal, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CafeCardsService } from '../../../core/services/cafe-cards';
import { SpeechService } from '../../../core/services/speech';
import { TranslationService, TargetLang } from '../../../core/services/translation';

/**
 * صفحة "سحب البطاقات" لفئة معينة.
 *
 * 🎯 منطق اللعبة:
 *   1) الفئة تحوي 15 سؤالاً.
 *   2) المستخدم يضغط "Draw" → يُختار سؤال عشوائي لم يُسحب بعد.
 *   3) البطاقة تنقلب بسلاسة (CSS transition بسيط) و تُظهر السؤال.
 *   4) السؤال يظهر مع: 🔊 Listen, 🌐 Translate, 🎴 Draw another.
 *   5) لما تنتهي الـ15 → زر "Start over" يخلط من جديد.
 *
 * 🎬 أنيميشن بسيط:
 *   isShowing = true  ← البطاقة تُظهر السؤال (rotateY 180)
 *   isShowing = false ← البطاقة على ظهرها (rotateY 0)
 *   transition: 0.6s ← تنتقل بين الحالتين بنعومة
 *
 *   تسلسل "اسحب بطاقة أخرى":
 *     flip back (600ms) → swap question → flip forward (600ms)
 *
 * 🎓 لماذا "no repeat in session"؟
 *   لأن سحب نفس السؤال مرتين متتاليتين يكسر الإيهام و التنوع.
 *   linkedSignal مع source = category → يعيد التهيئة لما يُغيّر الفئة.
 */

// CSS transition duration (ms) — must match cafe-draw-page.scss .card-3d transition.
const FLIP_MS = 600;
@Component({
  selector: 'app-cafe-draw-page',
  imports: [RouterLink],
  templateUrl: './cafe-draw-page.html',
  styleUrl: './cafe-draw-page.scss',
})
export class CafeDrawPage {
  /** id الفئة من URL */
  readonly categoryId = input.required<string>();

  // ───────── حقن ─────────
  private cafeService = inject(CafeCardsService);
  readonly speech = inject(SpeechService);
  private translationService = inject(TranslationService);
  private router = inject(Router);

  // ───────── Modal lifecycle (body scroll lock + ESC handler) ─────────

  /**
   * عند فتح الـ modal: نُقفل scroll الـ body (page behind shouldn't scroll).
   * عند الإغلاق (component destroy): نُستعيد scroll.
   *
   * 🎓 inject(DestroyRef) + onDestroy = نمط Angular الحديث للـ cleanup
   *    بدل ngOnDestroy التقليدي.
   */
  constructor() {
    document.body.style.overflow = 'hidden';
    inject(DestroyRef).onDestroy(() => {
      document.body.style.overflow = '';
    });
  }

  /**
   * مفتاح ESC = إغلاق الـ modal.
   * HostListener يربط الحدث على الـ document — يعمل حتى لو focus ليس على الـ modal.
   */
  @HostListener('document:keydown.escape')
  onEscape() {
    this.closeModal();
  }

  /** يُغلق الـ modal بإزالة الـ child route (يبقى على /cafe) */
  closeModal() {
    this.router.navigate(['/cafe']);
  }

  // ───────── بيانات مشتقّة ─────────
  readonly loaded = this.cafeService.loaded;
  readonly category = computed(() =>
    this.cafeService.categoryById(this.categoryId())()
  );

  readonly totalQuestions = computed(() => this.category()?.questions.length ?? 0);

  // ───────── حالة الجلسة ─────────

  /**
   * 🎲 السؤال الافتراضي (عشوائي) عند تحميل الفئة.
   *
   * هذا computed مُذاكَر (memoized): يُحسب مرة واحدة عند تغيّر category،
   * فالـ3 linkedSignal أدناه يقرؤونه و يحصلون جميعاً على نفس القيمة.
   * لو ولّد كل واحد قيمته بنفسه، لحصلنا على 3 أسئلة مختلفة.
   */
  private readonly initialIndex = computed<number | null>(() => {
    const cat = this.category();
    if (!cat || cat.questions.length === 0) return null;
    return Math.floor(Math.random() * cat.questions.length);
  });

  /**
   * Set من الـ indices التي سُحبت في هذه الجلسة.
   * يُهيَّأ بـ initialIndex كي يُحسب السؤال الأول كـ "مسحوب" منذ البداية.
   *
   * 🎓 لماذا Set و ليس Array؟
   *   - O(1) للبحث (has) — أسرع لما يكبر العدد
   */
  readonly drawnSet = linkedSignal({
    source: this.initialIndex,
    computation: (idx): Set<number> => {
      const s = new Set<number>();
      if (idx !== null) s.add(idx);
      return s;
    },
  });

  /** index السؤال الحالي — يبدأ بـ initialIndex (سؤال عشوائي تلقائي) */
  readonly currentIndex = linkedSignal<number | null, number | null>({
    source: this.initialIndex,
    computation: (idx) => idx,
  });

  /**
   * هل البطاقة تُظهر السؤال الآن؟
   *   true  = البطاقة مقلوبة و تُظهر السؤال
   *   false = البطاقة على ظهرها (أثناء flip-back عند "Draw another")
   *
   * يبدأ true لأن السؤال الأول يُعرض فوراً (بدون "Draw a card" أولي).
   * 🎯 ميزة CSS transitions: لو البداية = true، لا أنيميشن (الـ class موجود من البدء).
   */
  readonly isShowing = linkedSignal({
    source: this.initialIndex,
    computation: (idx) => idx !== null,
  });

  /**
   * Guard لمنع spam-clicks أثناء الـ flip (600ms).
   * هذا signal مُحلّي (ليس linkedSignal) لأنه لا يحتاج إعادة تهيئة مع الفئة.
   */
  private readonly animating = signal(false);

  /** الترجمة الحالية (null = لم تُطلب أو الجواب القديم تم مسحه) */
  readonly translation = signal<string | null>(null);
  readonly translating = signal(false);
  readonly translationLang = signal<TargetLang>('en');

  /**
   * 🆕 هل تُعرض الإجابة النموذجية الآن؟
   *
   * linkedSignal: يُعاد لـ false مع كل سؤال جديد (currentIndex يتغير)
   * → يضمن أن كل سؤال يبدأ بإجابة مخفية، يقررها المستخدم لو احتاج.
   */
  readonly showAnswer = linkedSignal({
    source: this.currentIndex,
    computation: () => false,
  });

  // ───────── computed مساعدة ─────────

  /**
   * السؤال الحالي ككائن CafeQuestion (يحوي text + sampleAnswer).
   * نحتاج accessors منفصلة (currentQuestionText, currentSampleAnswer)
   * للاستخدام البسيط في الـ template.
   */
  readonly currentQuestion = computed(() => {
    const cat = this.category();
    const idx = this.currentIndex();
    if (!cat || idx === null) return null;
    return cat.questions[idx] ?? null;
  });

  /** نص السؤال الألماني (للعرض و TTS و الترجمة) */
  readonly currentQuestionText = computed(() => this.currentQuestion()?.text ?? null);

  /** الإجابة النموذجية المقترحة (تُعرض بزر Show answer) */
  readonly currentSampleAnswer = computed(() => this.currentQuestion()?.sampleAnswer ?? null);

  /** كم سؤال تبقى لم يُسحب */
  readonly remainingCount = computed(() =>
    this.totalQuestions() - this.drawnSet().size
  );

  /** هل سُحبت كل الأسئلة؟ */
  readonly allDrawn = computed(() =>
    this.totalQuestions() > 0 && this.remainingCount() === 0
  );

  /** هل في بطاقة معروضة الآن؟ */
  readonly hasCurrent = computed(() => this.currentIndex() !== null);

  /** هل الزر "Draw" مُعطّل الآن؟ (أثناء الـ flip) */
  readonly isAnimating = this.animating.asReadonly();

  // ───────── الأفعال ─────────

  /**
   * يسحب سؤالاً جديداً عشوائياً من الأسئلة غير المسحوبة.
   *
   * Flow (دائماً نفس التسلسل لأن السؤال الحالي موجود دائماً):
   *   1) isShowing = false  → ينقلب للظهر (FLIP_MS)
   *   2) ثم: تغيّر السؤال + تنظيف الترجمة
   *   3) isShowing = true   → ينقلب للوجه (FLIP_MS)
   *
   * 🛡️ animating signal يمنع spam clicks خلال 2 × FLIP_MS.
   */
  draw() {
    if (this.animating()) return;

    const cat = this.category();
    if (!cat) return;

    const drawn = this.drawnSet();
    const available: number[] = [];
    for (let i = 0; i < cat.questions.length; i++) {
      if (!drawn.has(i)) available.push(i);
    }
    if (available.length === 0) return;

    const nextIdx = available[Math.floor(Math.random() * available.length)];

    this.animating.set(true);
    // اقلب للظهر أولاً
    this.isShowing.set(false);
    setTimeout(() => {
      // ثم استبدل السؤال
      this.currentIndex.set(nextIdx);
      this.drawnSet.update(s => {
        const copy = new Set(s);
        copy.add(nextIdx);
        return copy;
      });
      this.translation.set(null);
      // ثم اقلب للوجه (requestAnimationFrame يضمن DOM update قبل transition)
      requestAnimationFrame(() => {
        this.isShowing.set(true);
        setTimeout(() => this.animating.set(false), FLIP_MS);
      });
    }, FLIP_MS);
  }

  /**
   * إعادة الجلسة من الصفر:
   *   - نقلب للظهر
   *   - نُولّد سؤالاً عشوائياً جديداً (auto-pick، مثل أول تحميل)
   *   - نقلب للوجه
   */
  startOver() {
    if (this.animating()) return;
    const cat = this.category();
    if (!cat || cat.questions.length === 0) return;

    this.animating.set(true);
    this.isShowing.set(false);
    setTimeout(() => {
      // اختر سؤالاً جديداً تماماً و ابدأ جلسة جديدة
      const freshIdx = Math.floor(Math.random() * cat.questions.length);
      this.currentIndex.set(freshIdx);
      this.drawnSet.set(new Set<number>([freshIdx]));
      this.translation.set(null);
      requestAnimationFrame(() => {
        this.isShowing.set(true);
        setTimeout(() => this.animating.set(false), FLIP_MS);
      });
    }, FLIP_MS);
  }

  /** نطق السؤال الحالي بصوت ألماني */
  playQuestion() {
    const text = this.currentQuestionText();
    if (text) this.speech.speak(text);
  }

  /** 🆕 نطق الإجابة النموذجية بصوت ألماني */
  playSampleAnswer() {
    const answer = this.currentSampleAnswer();
    if (answer) this.speech.speak(answer);
  }

  /** 🆕 يُبدّل ظهور/إخفاء الإجابة النموذجية */
  toggleAnswer() {
    this.showAnswer.update(s => !s);
  }

  /**
   * ترجمة السؤال الحالي (cache في الـ service).
   * يستدعى من زر 🌐 — يطلب فقط عند الحاجة (لا ترجمة افتراضية).
   */
  translateQuestion() {
    const text = this.currentQuestionText();
    if (!text) return;
    this.translating.set(true);
    this.translationService.translate(text, this.translationLang()).subscribe({
      next: (translated) => {
        this.translation.set(translated);
        this.translating.set(false);
      },
      error: () => {
        this.translation.set('Translation failed.');
        this.translating.set(false);
      },
    });
  }

  /** تبديل لغة الترجمة (en ↔ ar). يمسح الترجمة الحالية. */
  toggleLang() {
    this.translationLang.update(l => (l === 'en' ? 'ar' : 'en'));
    this.translation.set(null);
  }
}
