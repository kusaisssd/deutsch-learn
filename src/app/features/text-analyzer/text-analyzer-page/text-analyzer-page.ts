import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TextAnalyzerService } from '../../../core/services/text-analyzer';
import { DictionaryService } from '../../../core/services/dictionary';
import { ClaudeLookupService } from '../../../core/services/claude-lookup';
import { SpeechService } from '../../../core/services/speech';
import { TAPhrase, TAVerb, TAWord, SavedLesson } from '../../../core/models/text-analysis.model';

interface Textsorte { id: string; label: string; }

const NIVEAUS = ['A2', 'B1', 'B2', 'C1'] as const;
const SORTEN: Textsorte[] = [
  { id: 'nachricht',    label: '📰 خبر صحفي' },
  { id: 'dialog',       label: '🗣 حوار' },
  { id: 'meinung',      label: '📝 مقال رأي' },
  { id: 'erfahrung',    label: '✍️ تجربة شخصيّة' },
  { id: 'wissenschaft', label: '🔬 علم و تكنولوجيا' },
  { id: 'rezension',    label: '⭐ مراجعة' },
];

@Component({
  selector: 'app-text-analyzer-page',
  imports: [RouterLink, FormsModule],
  templateUrl: './text-analyzer-page.html',
})
export class TextAnalyzerPage {
  svc = inject(TextAnalyzerService);
  private dict = inject(DictionaryService);
  claude = inject(ClaudeLookupService);
  speech = inject(SpeechService);

  readonly input = signal('');
  readonly analysis = signal<ReturnType<TextAnalyzerService['analyze']> extends Promise<infer R> ? R : never>(null as any);
  readonly savedId = signal<string | null>(null);
  readonly savedItems = signal<Set<string>>(new Set());

  // ─── مُولِّد النصّ ───
  readonly niveaus = NIVEAUS;
  readonly sorten = SORTEN;
  readonly genNiveau = signal<string>('B1');
  readonly genSorte = signal<string>('nachricht');
  readonly generating = signal(false);

  async generate() {
    if (this.generating()) return;
    this.generating.set(true);
    try {
      const result = await this.svc.generate(this.genNiveau(), this.genSorte());
      if (result) {
        this.input.set(result.text);
        this.analysis.set(null);
      }
    } finally {
      this.generating.set(false);
    }
  }

  // ─── ترجمة النصّ كاملاً (قبل التحليل أو بعده) ───
  readonly fullTranslation = signal<string>('');
  readonly translatingFull = signal(false);

  async translateFullText() {
    const t = this.input().trim();
    if (!t || this.translatingFull()) return;
    if (this.fullTranslation()) {
      this.fullTranslation.set(''); // toggle off
      return;
    }
    this.translatingFull.set(true);
    try {
      const prompt = 'ترجم هذا النصّ الألماني إلى العربيّة ترجمة أدبيّة طبيعيّة (ليست حرفيّة)، مع الحفاظ على الأسلوب و النبرة. أعطني فقط الترجمة بلا مقدّمات.';
      const answer = await this.claude.ask(t, prompt);
      if (answer) this.fullTranslation.set(answer);
    } finally {
      this.translatingFull.set(false);
    }
  }

  readonly charCount = computed(() => this.input().trim().length);
  readonly estimatedTokens = computed(() => Math.ceil(this.charCount() / 3) + 1200);
  // الحدّ الأقصى الآن 2500 (تفادي timeout Vercel Edge). الـ3000-5000 أمنها غير مضمون.
  readonly canAnalyze = computed(() => this.charCount() >= 50 && this.charCount() <= 2500 && !this.svc.loading());
  readonly isLongText = computed(() => this.charCount() > 1500);

  /** أسئلة Claude داخل الصفحة (نافذة منبثقة) */
  readonly askOpen = signal(false);
  readonly askType = signal<'word' | 'verb' | 'phrase' | 'grammar' | 'hinweis' | 'niveau' | 'generic'>('generic');
  readonly askLabel = signal('');
  readonly askContext = signal('');
  readonly askQuestion = signal('');
  readonly askAnswer = signal('');
  readonly askLoading = signal(false);
  readonly askError = signal<string | null>(null);

  /** حلول توصيات التطوير — key = index، value = نصّ الحلّ */
  readonly tippSolutions = signal<Record<number, string>>({});
  readonly tippLoading = signal<number | null>(null);

  async solveTipp(index: number, aspekt: string, uebung: string) {
    if (this.tippSolutions()[index] || this.tippLoading() !== null) return;
    if (!this.claude.available()) {
      this.openAsk(aspekt, uebung, 'niveau');
      return;
    }
    this.tippLoading.set(index);
    try {
      const prompt = `نفّذ هذا التمرين التدريبي بشكل مثاليّ و قدّم الحلّ الكامل مع شرح موجز (3-5 جمل كحدّ أقصى) باللغة العربيّة. التركيز على «${aspekt}».`;
      const answer = await this.claude.ask(uebung, prompt);
      if (answer) {
        this.tippSolutions.update(s => ({ ...s, [index]: answer }));
      }
    } finally {
      this.tippLoading.set(null);
    }
  }

  hideTippSolution(index: number) {
    this.tippSolutions.update(s => { const n = { ...s }; delete n[index]; return n; });
  }

  /** قوائم الأسئلة الجاهزة حسب نوع العنصر */
  private readonly PRESETS = {
    word: [
      { label: '💡 أمثلة من خارج النصّ', prompt: 'أعطني 5 جمل ألمانيّة أصليّة تستخدم هذه الكلمة في سياقات متنوّعة، على أن تكون **مختلفة تماماً** عن المثال في النصّ الأصلي. مع ترجمة عربيّة لكل جملة.' },
      { label: '🔗 مرادفات و أضداد', prompt: 'ما مرادفات هذه الكلمة بالألمانيّة و أضدادها؟ أعطني الأهمّ منها مع الفرق الدلالي.' },
      { label: '📐 التصريف الكامل', prompt: 'إن كانت اسماً: أعطني الحالات الأربع (Nom/Akk/Dat/Gen) مع الجمع. إن كانت صفة: أعطني مقارنتها (-er/-sten).' },
      { label: '🎯 متى أستعملها؟', prompt: 'متى تُستعمل هذه الكلمة بالضبط؟ ما السياقات الطبيعيّة لها؟ هل هي رسميّة أم محكيّة؟' },
      { label: '🧪 اختبرني', prompt: 'اصنع لي 3 جمل بفراغات لأُكملها لتدرّب على هذه الكلمة (مختلفة عن النصّ الأصلي)، ثم ضع الحلول في النهاية.' },
    ],
    verb: [
      { label: '💡 أمثلة من خارج النصّ', prompt: 'أعطني 5 جمل ألمانيّة تستخدم هذا الفعل في سياقات متنوّعة، **مختلفة تماماً** عن مثال النصّ الأصلي. مع ترجمة عربيّة.' },
      { label: '📐 جدول التصريف', prompt: 'أعطني جدول تصريف هذا الفعل في: Präsens، Präteritum، Perfekt، و Konjunktiv II (أهمّ الصيغ لكل زمن).' },
      { label: '🔗 أفعال مشابهة', prompt: 'أعطني 3 أفعال ألمانيّة قريبة المعنى، مع الفرق الدقيق بينها.' },
      { label: '🎯 بأزمنة مختلفة', prompt: 'أعطني 5 جمل تستخدم هذا الفعل في أزمنة مختلفة (ماضٍ، حاضر، Perfekt، مستقبل) مع ترجمة لكل جملة.' },
      { label: '⚡ البادئات', prompt: 'إن كان لهذا الفعل بادئات (مثل an-, auf-, ab-, ver-)، أعطني أهمّ المشتقّات مع تغيّر المعنى.' },
      { label: '🧪 اختبرني', prompt: 'اصنع لي 3 تمارين تدريبيّة بفراغات على تصريف هذا الفعل في أزمنة مختلفة، ثم ضع الحلول.' },
    ],
    phrase: [
      { label: '💡 أمثلة من خارج النصّ', prompt: 'أعطني 5 جمل ألمانيّة تستخدم هذه العبارة في محادثات أو نصوص متنوّعة، **مختلفة تماماً** عن النصّ الأصلي. مع ترجمة.' },
      { label: '🌍 السياق الثقافي', prompt: 'ما السياق الثقافي لهذه العبارة؟ متى يُستعملها الألمان؟ هل هناك عبارة مشابهة في العربيّة؟' },
      { label: '🔗 عبارات بديلة', prompt: 'أعطني عبارات ألمانيّة أخرى لها نفس المعنى تقريباً، مع الفرق في درجة الرسميّة.' },
      { label: '⚠️ أخطاء شائعة', prompt: 'ما الأخطاء الشائعة التي يقع فيها المتعلّمون العرب عند استعمال هذه العبارة؟' },
    ],
    grammar: [
      { label: '💡 أمثلة من خارج النصّ', prompt: 'أعطني 6 أمثلة ألمانيّة متنوّعة تطبّق هذه القاعدة، على أن تكون **كلّها جديدة** و ليست من النصّ الأصلي. مع ترجمة.' },
      { label: '⚠️ الاستثناءات', prompt: 'ما الاستثناءات و الحالات الخاصّة لهذه القاعدة؟' },
      { label: '🧠 طريقة الحفظ', prompt: 'أعطني طريقة ذكيّة أو قاعدة سهلة لتذكّر هذه القاعدة النحويّة.' },
      { label: '🧪 اختبرني', prompt: 'اصنع لي 5 جمل بفراغات لتدريبي على هذه القاعدة مع تنوّع الصعوبة، ثم ضع الحلول.' },
    ],
    hinweis: [
      { label: '💡 أمثلة من خارج النصّ', prompt: 'أعطني 4 أمثلة ألمانيّة إضافيّة توضّح هذه الملاحظة، **مختلفة عن النصّ الأصلي**، مع ترجمة.' },
      { label: '🔍 اشرح بالتفصيل', prompt: 'اشرح هذه الملاحظة بتفصيل أكبر مع 3 أمثلة واقعيّة.' },
      { label: '⚠️ أمثلة الخطأ و الصحّ', prompt: 'أعطني مقارنة واضحة بين الاستعمال الخطأ و الصحيح لهذه النقطة.' },
    ],
    niveau: [
      { label: '📝 أعطني الحلّ', prompt: 'نفّذ هذا التمرين التدريبي بشكل مثاليّ، قدّم الحلّ الكامل مع شرح موجز (3-5 جمل كحدّ أقصى).' },
      { label: '🧪 تمرين مماثل آخر', prompt: 'اصنع لي تمريناً مماثلاً جديداً من نوع مختلف قليلاً، ثم ضع الحلّ.' },
      { label: '🔍 اشرح الجانب', prompt: 'اشرح لي هذا الجانب النحوي أو المهاري بتفصيل مع 3 أمثلة لتجنّب الخطأ.' },
      { label: '📚 موارد تعلّم', prompt: 'ما أفضل الطرق أو المصادر لتدريب هذا الجانب؟ أعطني خطّة تدريب لأسبوع.' },
    ],
    generic: [
      { label: '💡 أمثلة من خارج النصّ', prompt: 'أعطني 5 أمثلة ألمانيّة إضافيّة متعلّقة بهذا السياق، **مختلفة** عن النصّ الأصلي، مع ترجمة.' },
      { label: '📚 اشرح أكثر', prompt: 'اشرح لي هذا الجزء بتفصيل أكبر و أمثلة.' },
      { label: '🧪 اختبرني', prompt: 'اصنع لي 3 أسئلة تدريبيّة قصيرة على هذا السياق، ثم ضع الحلول.' },
      { label: '🎯 أهمّ النقاط', prompt: 'ما أهمّ 3 نقاط يجب أن أتذكّرها من هذا السياق؟' },
    ],
  };

  readonly askPresets = computed(() => this.PRESETS[this.askType()] ?? this.PRESETS.generic);

  async run() {
    if (!this.canAnalyze()) return;
    this.analysis.set(null);
    this.savedId.set(null);
    this.savedItems.set(new Set());
    this.fullTranslation.set('');
    const result = await this.svc.analyze(this.input());
    if (result) {
      this.analysis.set(result);
      const id = this.svc.saveLesson(this.input(), result);
      this.savedId.set(id);
    }
  }

  loadSaved(l: SavedLesson) {
    this.input.set(l.originaltext);
    this.analysis.set(l.analyse);
    this.savedId.set(l.id);
  }

  speak(text: string, ev?: Event) {
    ev?.stopPropagation();
    this.speech.speak(text);
  }

  // ─── أضف إلى القاموس ───
  addPhrase(p: TAPhrase) {
    const key = 'phrase:' + p.phrase;
    this.dict.record({ word: p.phrase, kind: 'phrase', translation: p.ar });
    if (p.satz) {
      this.dict.appendAsk(p.phrase, 'phrase', {
        q: 'السياق من النصّ الأصلي',
        a: p.satz + (p.erklaerungAr ? '\n\n' + p.erklaerungAr : ''),
        preset: 'analyzer',
      });
    }
    this.markAdded(key);
  }
  addWord(w: TAWord) {
    const key = 'word:' + w.wort;
    const article = w.artikel?.trim() || undefined;
    this.dict.record({ word: w.wort, kind: 'noun', translation: w.ar, article });
    if (w.satz) {
      this.dict.appendAsk(w.wort, 'noun', {
        q: 'السياق من النصّ', a: w.satz, preset: 'analyzer',
      });
    }
    this.markAdded(key);
  }
  addVerb(v: TAVerb) {
    const key = 'verb:' + v.infinitiv;
    this.dict.record({ word: v.infinitiv, kind: 'verb', translation: v.ar });
    const extras = [v.partizip ? 'Partizip II: ' + v.partizip : '', v.praeposition ? 'مع حرف جرّ: ' + v.praeposition : '', v.satz ? '\nمن النصّ: ' + v.satz : ''].filter(Boolean).join('\n');
    if (extras) {
      this.dict.appendAsk(v.infinitiv, 'verb', { q: 'ملاحظات تصريفيّة', a: extras, preset: 'analyzer' });
    }
    this.markAdded(key);
  }
  addAll() {
    const a = this.analysis();
    if (!a) return;
    a.redewendungen.forEach(p => this.addPhrase(p));
    a.schluesselwoerter.forEach(w => this.addWord(w));
    a.verben.forEach(v => this.addVerb(v));
  }
  private markAdded(key: string) {
    this.savedItems.update(s => new Set(s).add(key));
  }
  isAdded(key: string): boolean { return this.savedItems().has(key); }

  // ─── اسأل Claude عن عنصر ───
  openAsk(label: string, context: string, type: 'word' | 'verb' | 'phrase' | 'grammar' | 'hinweis' | 'niveau' | 'generic' = 'generic') {
    this.askType.set(type);
    this.askLabel.set(label);
    this.askContext.set(context);
    this.askQuestion.set('');
    this.askAnswer.set('');
    this.askError.set(null);
    this.askOpen.set(true);
  }
  closeAsk() { this.askOpen.set(false); }

  usePreset(prompt: string) {
    this.askQuestion.set(prompt);
    this.submitAsk();
  }

  async submitAsk() {
    const q = this.askQuestion().trim();
    if (q.length < 2 || this.askLoading()) return;
    this.askLoading.set(true);
    this.askError.set(null);
    try {
      const context = `[السياق: ${this.askLabel()}]\n${this.askContext()}`;
      const answer = await this.claude.ask(context, q);
      if (answer) this.askAnswer.set(answer);
      else this.askError.set('تعذّر الحصول على جواب.');
    } finally {
      this.askLoading.set(false);
    }
  }

  deleteSaved(id: string, ev: Event) {
    ev.stopPropagation();
    this.svc.deleteLesson(id);
    if (this.savedId() === id) {
      this.analysis.set(null);
      this.savedId.set(null);
    }
  }

  formatDate(ts: number): string {
    return new Date(ts).toLocaleString('de-DE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  wordCount(text: string): number { return text.trim().split(/\s+/).filter(Boolean).length; }
}
