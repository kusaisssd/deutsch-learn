import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TextAnalyzerService } from '../../../core/services/text-analyzer';
import { DictionaryService } from '../../../core/services/dictionary';
import { ClaudeLookupService } from '../../../core/services/claude-lookup';
import { SpeechService } from '../../../core/services/speech';
import { TAPhrase, TAVerb, TAWord, SavedLesson } from '../../../core/models/text-analysis.model';

/** أمثلة سريعة لتجربة الأداة */
interface Beispielsnippet { label: string; text: string; }

const BEISPIELE: Beispielsnippet[] = [
  {
    label: '📰 خبر B1',
    text: 'Berlin — Immer mehr junge Menschen in Deutschland entscheiden sich für ein Studium im Ausland. Nach aktuellen Zahlen haben im vergangenen Jahr rund 140.000 deutsche Studierende ein oder mehrere Semester an einer ausländischen Universität verbracht. Die beliebtesten Länder sind Österreich, die Niederlande und die Schweiz. Experten sehen darin eine positive Entwicklung, weisen aber darauf hin, dass die Finanzierung für viele weiterhin eine große Hürde darstellt.',
  },
  {
    label: '📝 مقال رأي',
    text: 'Soziale Medien haben unser Leben grundlegend verändert. Einerseits ermöglichen sie es uns, mit Freunden und Familie überall auf der Welt in Kontakt zu bleiben. Andererseits führen sie oft zu Stress und Vergleichsdruck. Viele Jugendliche verbringen täglich mehrere Stunden auf Plattformen wie Instagram und TikTok. Meiner Meinung nach sollten wir lernen, bewusst mit diesen Medien umzugehen. Weniger ist manchmal mehr — besonders wenn es um unsere mentale Gesundheit geht.',
  },
  {
    label: '🗣 حوار يومي',
    text: 'A: Hast du schon gehört? Max ist umgezogen.\nB: Wirklich? Wohin denn?\nA: Nach Hamburg. Er hat dort einen neuen Job gefunden.\nB: Das ist ja eine große Veränderung. Weißt du, in welcher Firma er jetzt arbeitet?\nA: Bei einer Internetfirma. Er fängt nächsten Monat an und freut sich sehr darauf.\nB: Schön für ihn! Aber Hamburg ist ganz schön weit weg. Wie habt ihr euch verabschiedet?\nA: Wir haben zusammen gegessen und uns versprochen, uns regelmäßig zu besuchen.',
  },
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

  readonly beispiele = BEISPIELE;

  readonly charCount = computed(() => this.input().trim().length);
  readonly estimatedTokens = computed(() => Math.ceil(this.charCount() / 3) + 1200);
  // الحدّ الأقصى الآن 2500 (تفادي timeout Vercel Edge). الـ3000-5000 أمنها غير مضمون.
  readonly canAnalyze = computed(() => this.charCount() >= 50 && this.charCount() <= 2500 && !this.svc.loading());
  readonly isLongText = computed(() => this.charCount() > 1500);

  /** أسئلة Claude داخل الصفحة (نافذة منبثقة) */
  readonly askOpen = signal(false);
  readonly askType = signal<'word' | 'verb' | 'phrase' | 'grammar' | 'hinweis' | 'generic'>('generic');
  readonly askLabel = signal('');
  readonly askContext = signal('');
  readonly askQuestion = signal('');
  readonly askAnswer = signal('');
  readonly askLoading = signal(false);
  readonly askError = signal<string | null>(null);

  /** قوائم الأسئلة الجاهزة حسب نوع العنصر */
  private readonly PRESETS = {
    word: [
      { label: '📝 5 أمثلة أخرى', prompt: 'أعطني 5 جمل ألمانيّة إضافيّة متنوّعة تستخدم هذه الكلمة في سياقات مختلفة، مع ترجمة عربيّة لكل جملة.' },
      { label: '🔗 مرادفات و أضداد', prompt: 'ما مرادفات هذه الكلمة بالألمانيّة و أضدادها؟ أعطني الأهمّ منها مع الفرق الدلالي.' },
      { label: '📐 التصريف الكامل', prompt: 'إن كانت اسماً: أعطني الحالات الأربع (Nom/Akk/Dat/Gen) مع الجمع. إن كانت صفة: أعطني مقارنتها (-er/-sten).' },
      { label: '🎯 متى أستعملها؟', prompt: 'متى تُستعمل هذه الكلمة بالضبط؟ ما السياقات الطبيعيّة لها؟ هل هي رسميّة أم محكيّة؟' },
      { label: '🧪 اختبرني', prompt: 'اصنع لي 3 جمل بفراغات لأُكملها لتدرّب على هذه الكلمة، ثم ضع الحلول في النهاية.' },
    ],
    verb: [
      { label: '📐 جدول التصريف', prompt: 'أعطني جدول تصريف هذا الفعل في: Präsens، Präteritum، Perfekt، و Konjunktiv II (أهمّ الصيغ لكل زمن).' },
      { label: '🔗 أفعال مشابهة', prompt: 'أعطني 3 أفعال ألمانيّة قريبة المعنى، مع الفرق الدقيق بينها.' },
      { label: '🎯 بأزمنة مختلفة', prompt: 'أعطني 5 جمل تستخدم هذا الفعل في أزمنة مختلفة (ماضٍ، حاضر، Perfekt، مستقبل) مع ترجمة لكل جملة.' },
      { label: '⚡ البادئات', prompt: 'إن كان لهذا الفعل بادئات (مثل an-, auf-, ab-, ver-)، أعطني أهمّ المشتقّات مع تغيّر المعنى.' },
      { label: '🧪 اختبرني', prompt: 'اصنع لي 3 تمارين تدريبيّة بفراغات على تصريف هذا الفعل في أزمنة مختلفة، ثم ضع الحلول.' },
    ],
    phrase: [
      { label: '🌍 السياق الثقافي', prompt: 'ما السياق الثقافي لهذه العبارة؟ متى يُستعملها الألمان؟ هل هناك عبارة مشابهة في العربيّة؟' },
      { label: '📝 5 أمثلة', prompt: 'أعطني 5 أمثلة مختلفة تستخدم فيها هذه العبارة في محادثات أو نصوص، مع ترجمة.' },
      { label: '🔗 عبارات بديلة', prompt: 'أعطني عبارات ألمانيّة أخرى لها نفس المعنى تقريباً، مع الفرق في درجة الرسميّة.' },
      { label: '⚠️ أخطاء شائعة', prompt: 'ما الأخطاء الشائعة التي يقع فيها المتعلّمون العرب عند استعمال هذه العبارة؟' },
    ],
    grammar: [
      { label: '📝 أمثلة أكثر', prompt: 'أعطني 6 أمثلة إضافيّة متنوّعة تطبّق هذه القاعدة، مع ترجمة عربيّة.' },
      { label: '⚠️ الاستثناءات', prompt: 'ما الاستثناءات و الحالات الخاصّة لهذه القاعدة؟' },
      { label: '🧠 طريقة الحفظ', prompt: 'أعطني طريقة ذكيّة أو قاعدة سهلة لتذكّر هذه القاعدة النحويّة.' },
      { label: '🧪 اختبرني', prompt: 'اصنع لي 5 جمل بفراغات لتدريبي على هذه القاعدة مع تنوّع الصعوبة، ثم ضع الحلول.' },
    ],
    hinweis: [
      { label: '🔍 اشرح بالتفصيل', prompt: 'اشرح هذه الملاحظة بتفصيل أكبر مع 3 أمثلة واقعيّة.' },
      { label: '⚠️ أمثلة الخطأ و الصحّ', prompt: 'أعطني مقارنة واضحة بين الاستعمال الخطأ و الصحيح لهذه النقطة.' },
    ],
    generic: [
      { label: '📚 اشرح أكثر', prompt: 'اشرح لي هذا الجزء بتفصيل أكبر و أمثلة.' },
      { label: '🧪 اختبرني', prompt: 'اصنع لي 3 أسئلة تدريبيّة قصيرة على هذا السياق، ثم ضع الحلول.' },
      { label: '🎯 أهمّ النقاط', prompt: 'ما أهمّ 3 نقاط يجب أن أتذكّرها من هذا السياق؟' },
    ],
  };

  readonly askPresets = computed(() => this.PRESETS[this.askType()] ?? this.PRESETS.generic);

  loadBeispiel(b: Beispielsnippet) {
    this.input.set(b.text);
    this.analysis.set(null);
  }

  async run() {
    if (!this.canAnalyze()) return;
    this.analysis.set(null);
    this.savedId.set(null);
    this.savedItems.set(new Set());
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
  openAsk(label: string, context: string, type: 'word' | 'verb' | 'phrase' | 'grammar' | 'hinweis' | 'generic' = 'generic') {
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
