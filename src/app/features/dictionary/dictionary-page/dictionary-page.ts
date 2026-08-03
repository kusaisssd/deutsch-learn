import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DictionaryService } from '../../../core/services/dictionary';
import { ClaudeLookupService } from '../../../core/services/claude-lookup';
import { SpeechService } from '../../../core/services/speech';
import { DictAsk } from '../../../core/models/claude-lookup.model';

/** طلبات جاهزة يستطيع المستخدم إرسالها بضغطة واحدة */
export interface PresetQuestion {
  id: string;
  icon: string;
  label: string;   // نص الزرّ (عربي)
  prompt: string;  // السؤال الذي يُرسل لـ Claude
}

const PRESET_QUESTIONS: PresetQuestion[] = [
  { id: 'explain',    icon: '📚', label: 'اشرح لي',           prompt: 'اشرح لي هذه الكلمة بشكل واضح مع سياق استخدامها في الحياة اليومية.' },
  { id: 'examples',   icon: '💬', label: 'المزيد من الأمثلة', prompt: 'أعطني 5 أمثلة متنوّعة من الحياة اليومية مع ترجمة عربية لكل جملة.' },
  { id: 'conjugate',  icon: '📐', label: 'التصريف',            prompt: 'أعطني جدول التصريف الكامل (الأزمنة الأساسية إن كان فعلاً، أو الحالات الأربع إن كان اسماً) بطريقة مرتّبة.' },
  { id: 'synonyms',   icon: '🔗', label: 'مرادفات و أضداد',    prompt: 'أعطني قائمة من المرادفات و الأضداد الأكثر شيوعاً، مع الفرق بينها.' },
  { id: 'mistakes',   icon: '⚠️', label: 'أخطاء شائعة',        prompt: 'ما الأخطاء الشائعة التي يقع فيها المتحدّثون بالعربية عند استعمال هذه الكلمة؟' },
  { id: 'culture',    icon: '🌍', label: 'الاستخدام الثقافي',  prompt: 'اشرح لي السياق الثقافي و متى تُستعمل هذه الكلمة في ألمانيا مقارنةً بالعالم العربي.' },
];

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
  imports: [RouterLink],
  templateUrl: './dictionary-page.html',
})
export class DictionaryPage {
  private dict = inject(DictionaryService);
  readonly claude = inject(ClaudeLookupService);
  readonly speech = inject(SpeechService);

  readonly loading = this.dict.loading;
  readonly error = this.dict.error;
  readonly ready = this.dict.ready;

  /** وضع البحث: محلي (offline) أو Claude AI */
  readonly searchMode = signal<'local' | 'ai'>('local');
  setMode(m: 'local' | 'ai') {
    this.searchMode.set(m);
    this.claude.clearResult();
  }

  readonly presets = PRESET_QUESTIONS;
  readonly customQuestion = signal('');
  readonly asking = signal<string | null>(null); // معرّف الـpreset أو 'custom' أثناء التحميل
  readonly askError = signal<string | null>(null);

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

  /** إكمال تلقائي حيّ أثناء الكتابة (≥3 أحرف، يختفي بعد البحث) */
  readonly liveSuggestions = computed(() => {
    const q = this.query().trim();
    if (q.length < 3 || q === this.submitted()) return [];
    return this.dict.prefixSuggest(q);
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
        // غير موجودة في القاموس الصرفي؟ نطلب ترجمتها على الأقل (online + cache)
        if (!r.noun && !r.verb) this.dict.translate(r.query);
      });
    });

    // 🤖 عند نجاح Claude AI: سجّل الكلمة + استجابة AI في السجلّ
    effect(() => {
      const ai = this.claude.result();
      if (!ai) return;
      untracked(() => {
        const kind: 'noun' | 'verb' | 'phrase' =
          ai.type === 'verb' ? 'verb' : (ai.type === 'noun' ? 'noun' : 'phrase');
        this.dict.record({
          word: ai.word,
          kind,
          article: ai.article ?? undefined,
          translation: ai.arabicTranslation,
          ai: ai,
        });
      });
    });

    // 💬 عند وصول ترجمة عربية (MyMemory) → أضِفها لمدخل السجلّ
    effect(() => {
      const r = this.result();
      if (!r) return;
      untracked(() => {
        if (r.noun) {
          const t = this.dict.translationOf(r.noun.word);
          if (t) this.dict.enrich(r.noun.word, 'noun', { translation: t });
        }
        if (r.verb) {
          const t = this.dict.translationOf(r.verb.infinitive);
          if (t) this.dict.enrich(r.verb.infinitive, 'verb', { translation: t });
        }
      });
    });
  }

  // ───────── روابط غوغل (صور + أمثلة) ─────────

  /**
   * بحث صور غوغل عن *معنى* الكلمة لا عن عنوان فيلم/كتاب يحمل نفس الاسم.
   * الحيلة: نضيف «Foto» (صورة فوتوغرافية) لتحيّز النتائج نحو صور تصف الشيء،
   * و نستبعد الضجيج الشائع (أفلام، كتب، ملصقات، صفحات تسوّق).
   */
  googleImages(word: string): string {
    const q = `${word} Foto -film -buch -poster -kaufen -amazon`;
    return 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(q);
  }

  /**
   * أمثلة واقعية مع ترجمة عربية لكل جملة عبر Reverso Context (ألماني→عربي).
   * أفضل من بحث غوغل العام: كل جملة مثال مقترنة بترجمتها العربية مباشرةً.
   */
  reversoExamples(word: string): string {
    return 'https://context.reverso.net/translation/german-arabic/' + encodeURIComponent(word);
  }

  /** بحث غوغل بعبارة: ترجم "الكلمة" إلى العربية (للكلمات غير الموجودة) */
  googleTranslateSearch(word: string): string {
    return 'https://www.google.com/search?q=' + encodeURIComponent(`ترجم "${word}" إلى العربية`);
  }

  /** صفحة الكلمة في ويكاموس الألماني (معاني، تصريف، ترجمات) */
  wiktionary(word: string): string {
    return 'https://de.wiktionary.org/wiki/' + encodeURIComponent(word);
  }

  search(): void {
    const q = this.query().trim();
    this.submitted.set(q);
    // بحث جديد → صفّر أسئلة الحوار السابقة
    this.customQuestion.set('');
    this.askError.set(null);
    if (q && this.searchMode() === 'ai') {
      this.claude.lookup(q);
    }
  }

  /** ─── Q&A حول الكلمة الحاليّة ─── */

  /** أزرار جاهزة: إرسال preset مباشر */
  async askPreset(p: PresetQuestion): Promise<void> {
    return this.runAsk(p.prompt, p.id);
  }
  /** المربّع الحرّ: أرسل ما كتبه المستخدم */
  async askCustom(): Promise<void> {
    const q = this.customQuestion().trim();
    if (q.length < 2) return;
    await this.runAsk(q, undefined);
    this.customQuestion.set('');
  }

  private async runAsk(prompt: string, preset: string | undefined): Promise<void> {
    const target = this.currentTargetWord();
    if (!target) return;
    if (this.asking()) return;
    this.asking.set(preset ?? 'custom');
    this.askError.set(null);
    try {
      const answer = await this.claude.ask(target.word, prompt);
      if (!answer) {
        this.askError.set('تعذّر الحصول على جواب.');
        return;
      }
      // احفظ في السجلّ (لتظهر في المراجعة لاحقاً)
      this.dict.appendAsk(target.word, target.kind, { q: prompt, a: answer, preset });
    } finally {
      this.asking.set(null);
    }
  }

  /** آخر كلمة/عبارة جرى البحث عنها (لأسئلة AI) */
  currentTargetWord(): { word: string; kind: 'noun' | 'verb' | 'phrase' } | null {
    const ai = this.claude.result();
    if (ai) {
      const kind: 'noun' | 'verb' | 'phrase' =
        ai.type === 'verb' ? 'verb' : ai.type === 'noun' ? 'noun' : 'phrase';
      return { word: ai.word, kind };
    }
    const r = this.result();
    if (r?.noun) return { word: r.noun.word, kind: 'noun' };
    if (r?.verb) return { word: r.verb.infinitive, kind: 'verb' };
    if (r?.query) return { word: r.query, kind: 'phrase' };
    return null;
  }

  /** أسئلة/أجوبة سابقة للكلمة الحاليّة (تعرض تحت النتيجة) */
  readonly currentAsks = computed<DictAsk[]>(() => {
    const t = this.currentTargetWord();
    if (!t) return [];
    const entry = this.dict.history().find(e => e.word === t.word && e.kind === t.kind);
    return (entry?.asks as DictAsk[] | undefined) ?? [];
  });

  /** بحث مباشر عن كلمة (من رقاقة اقتراح) */
  searchWord(word: string): void {
    this.query.set(word);
    this.submitted.set(word);
    if (this.searchMode() === 'ai') this.claude.lookup(word);
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
