import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { B2PruefungService } from '../../../core/services/b2-pruefung';
import { SpeechService } from '../../../core/services/speech';
import { ClaudeLookupService } from '../../../core/services/claude-lookup';
import { B2TeilA, B2TeilB, B2TeilC, B2TeilD, B2TeilE } from '../../../core/models/b2-pruefung.model';

@Component({
  selector: 'app-b2-sitzung-page',
  imports: [RouterLink],
  templateUrl: './b2-sitzung-page.html',
})
export class B2SitzungPage {
  svc = inject(B2PruefungService);
  speech = inject(SpeechService);
  claude = inject(ClaudeLookupService);

  /** URL parameter: /b2-pruefung/:sitzungId */
  readonly sitzungId = input.required<string>();

  readonly sitzung = computed(() => this.svc.getSitzung(this.sitzungId()));

  /** حالة طيّ لكل Teil (مفتوح/مغلق) — افتراضياً فقط Teil A مفتوح */
  readonly expanded = signal<Record<string, boolean>>({ A: true, B: false, C: false, D: false, E: false });

  // ─── ترجمة فوريّة للمقاطع (عبر Claude) ───
  readonly translations = signal<Record<string, string>>({});  // key: section-id → arabic text
  readonly translating = signal<string | null>(null);

  async translate(key: string, germanText: string) {
    // طيّ إذا موجود
    if (this.translations()[key]) {
      this.translations.update(t => { const n = { ...t }; delete n[key]; return n; });
      return;
    }
    if (this.translating()) return;
    if (!this.claude.available()) {
      this.openAsk('خدمة الترجمة', germanText);
      return;
    }
    this.translating.set(key);
    try {
      const prompt = 'ترجم النصّ التالي إلى العربيّة ترجمة طبيعيّة أدبيّة (ليست حرفيّة)، مع الحفاظ على الأسلوب و النبرة. أعطني فقط الترجمة، بدون مقدّمات.';
      const answer = await this.claude.ask(germanText, prompt);
      if (answer) this.translations.update(t => ({ ...t, [key]: answer }));
    } finally {
      this.translating.set(null);
    }
  }

  translationOf(key: string): string | undefined { return this.translations()[key]; }
  isTranslating(key: string) { return this.translating() === key; }

  // ─── اسأل Claude عن أي شيء في الدرس (Modal) ───
  readonly askOpen = signal(false);
  readonly askContextLabel = signal<string>('');  // «القسم: Teil A — نصّ قراءة»
  readonly askContextText = signal<string>('');   // النصّ الكامل المرجعي
  readonly askQuestion = signal('');
  readonly askAnswer = signal('');
  readonly askLoading = signal(false);
  readonly askError = signal<string | null>(null);

  /** تلميحات جاهزة يختار منها المستخدم بسرعة */
  readonly askPresets = [
    { label: '📚 اشرح أكثر', text: 'اشرح لي هذا الجزء بتفصيل أكبر و بأمثلة إضافيّة.' },
    { label: '🔑 الكلمات الصعبة', text: 'ما الكلمات الصعبة في هذا الجزء؟ أعطني ترجماتها و أمثلة استعمال.' },
    { label: '📐 القاعدة النحويّة', text: 'اشرح لي القاعدة النحويّة التي تظهر هنا بشكل مبسّط مع 3 أمثلة إضافيّة.' },
    { label: '🎯 نقاط مهمّة', text: 'ما أهمّ 3 نقاط يجب أن أتذكّرها من هذا الجزء للامتحان؟' },
    { label: '🧪 اختبرني', text: 'اصنع لي 3 أسئلة تدريبيّة قصيرة على هذا الجزء، ثم أعطني الحلول في النهاية.' },
  ];

  openAsk(contextLabel: string, contextText: string) {
    this.askContextLabel.set(contextLabel);
    this.askContextText.set(contextText);
    this.askQuestion.set('');
    this.askAnswer.set('');
    this.askError.set(null);
    this.askOpen.set(true);
  }

  closeAsk() { this.askOpen.set(false); }

  usePreset(text: string) {
    this.askQuestion.set(text);
    this.submitAsk();
  }

  async submitAsk() {
    const q = this.askQuestion().trim();
    if (q.length < 2 || this.askLoading()) return;
    if (!this.claude.available()) {
      this.askError.set('خدمات AI مقفلة. اضبط passphrase من صفحة إعدادات القاموس.');
      return;
    }
    this.askLoading.set(true);
    this.askError.set(null);
    try {
      const s = this.sitzung();
      const sessionTitle = s ? `جلسة ${s.nummer}: ${s.titelDe}` : 'جلسة B2';
      const combined = `[السياق المرجعي من ${sessionTitle} — ${this.askContextLabel()}]\n\n${this.askContextText()}`;
      const answer = await this.claude.ask(combined, q);
      if (answer) this.askAnswer.set(answer);
      else this.askError.set('تعذّر الحصول على جواب.');
    } catch {
      this.askError.set('خطأ في الاتصال.');
    } finally {
      this.askLoading.set(false);
    }
  }

  speakAnswer() {
    const a = this.askAnswer();
    if (a) this.speech.speak(a);
  }

  readonly nextSitzung = computed(() => {
    const list = this.svc.sitzungen();
    const cur = this.sitzung();
    if (!cur) return null;
    const idx = list.findIndex(s => s.id === cur.id);
    return idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;
  });

  readonly prevSitzung = computed(() => {
    const list = this.svc.sitzungen();
    const cur = this.sitzung();
    if (!cur) return null;
    const idx = list.findIndex(s => s.id === cur.id);
    return idx > 0 ? list[idx - 1] : null;
  });

  toggleTeil(key: string) {
    this.expanded.update(e => ({ ...e, [key]: !e[key] }));
  }

  isExpanded(key: string) { return this.expanded()[key] ?? false; }

  speak(text: string, ev?: Event) {
    ev?.stopPropagation();
    this.speech.speak(text);
  }

  // ─── نوع-ضيّق: مساعد type guards للقالب ───
  asA(t: unknown): B2TeilA | null { return (t as B2TeilA).typ === 'wortschatz_lesen' ? (t as B2TeilA) : null; }
  asB(t: unknown): B2TeilB | null { return (t as B2TeilB).typ === 'grammatik' ? (t as B2TeilB) : null; }
  asC(t: unknown): B2TeilC | null { return (t as B2TeilC).typ === 'hoeren' ? (t as B2TeilC) : null; }
  asD(t: unknown): B2TeilD | null { return (t as B2TeilD).typ === 'sprechen' ? (t as B2TeilD) : null; }
  asE(t: unknown): B2TeilE | null { return (t as B2TeilE).typ === 'schreiben' ? (t as B2TeilE) : null; }

  /** يستخرج نصّ Teil ككتلة واحدة ليُرسل للـAI كـ«context» */
  teilContextText(teil: unknown): string {
    const a = this.asA(teil);
    if (a) return `[${a.titel}]\n\nLesetext: ${a.lesetext.titel}\n${a.lesetext.text}`;
    const b = this.asB(teil);
    if (b) return `[${b.titel}]\n\nThema: ${b.grammatik.thema}\n${b.grammatik.erklaerung}\n\nBeispiele:\n${b.grammatik.beispielsaetze.join('\n')}`;
    const c = this.asC(teil);
    if (c) return `[${c.titel}]\n\nHörtext: ${c.hoertext.titel} (${c.hoertext.format})\n${c.hoertext.transkript}`;
    const d = this.asD(teil);
    if (d) return `[${d.titel}]\n\nAnlass: ${d.sprechen.anlass}\nThema: ${d.sprechen.thema}\nAufgabe: ${d.sprechen.anweisung}`;
    const e = this.asE(teil);
    if (e) return `[${e.titel}]\n\nTextsorte: ${e.schreiben.textsorte}\nAufgabe: ${e.schreiben.aufgabenstellung}\n\nMustertext:\n${e.schreiben.mustertext}`;
    return '';
  }

  /** نصّ السياق لـ "اسأل عن الدرس كاملاً" */
  fullSessionContext(): string {
    const s = this.sitzung();
    if (!s) return '';
    return `جلسة ${s.nummer}: ${s.titelDe} (${s.titelAr})\nPrüfungsbezug: ${s.pruefungsbezug}\nLernziele:\n${s.lernziele.join('\n')}\n\nالدرس يحتوي ${s.teile.length} أقسام (Teil A..E).`;
  }

  /** مقدّمة عربيّة ثابتة لكل نوع Teil — تفسير «ماذا نفعل هنا» */
  teilEinleitungAr(key: string): { titel: string; intro: string; tipp: string } {
    switch (key) {
      case 'A': return {
        titel: '📖 القسم أ — القراءة و المفردات',
        intro: 'ستقرأ نصّاً ألمانياً أصليّاً بمستوى B2 (نحو 150-200 كلمة). اقرأه مرّتَين: الأولى بسرعة لفهم الفكرة العامّة، الثانية ببطء لرصد التفاصيل. ثم أجب عن أسئلة الفهم.',
        tipp: '💡 إن احتجت الترجمة، اضغط «🌐 ترجم للعربيّة» تحت النصّ. استعمل زرّ «🔊» للاستماع للنطق الصحيح.'
      };
      case 'B': return {
        titel: '📐 القسم ب — القاعدة النحويّة',
        intro: 'هذا أهمّ قسم للامتحان. ستتعلّم قاعدة نحويّة من قواعد B2. اقرأ الشرح بالألماني (أو ترجمه)، ادرس جدول الصيغ، ثم طبّق على التمارين. **الهدف: فهم القاعدة لا حفظها.**',
        tipp: '💡 بعد كل تمرين، افتح «✓ Lösung» للتحقّق. إن لم تفهم، اضغط زرّ «🤖 اسأل Claude» و اطلب شرحاً مبسّطاً.'
      };
      case 'C': return {
        titel: '🎧 القسم ج — الاستماع',
        intro: 'نصّ استماع بتنسيق مشابه للامتحان. **الخطوة الأولى: اقرأ الأسئلة قبل الاستماع**، ثم اضغط «🔊 استمع» و حاول الفهم بلا نظر للنصّ. أخيراً افتح الـ Transkript إن احتجت.',
        tipp: '💡 لا تحاول فهم كل كلمة. الهدف: الفكرة العامّة + 2-3 تفاصيل محدّدة. استعمل زرّ الترجمة لمراجعة ما لم تفهمه.'
      };
      case 'D': return {
        titel: '🎤 القسم د — المحادثة',
        intro: 'ستتدرّب على التحدّث الفعلي. **لا تتخطَّ هذا القسم** — المحادثة أهمّ ما يفرّق بين B1 و B2. استعمل الـ Redemittel (العبارات الجاهزة) كـ«قوالب» تملؤها بأفكارك.',
        tipp: '💡 سجّل نفسك بالموبايل أثناء التكلّم. ثم استمع و لاحظ: هل كلامك طلق؟ هل استعملت الـ Redemittel؟ أي كلمة تلعثمت فيها؟'
      };
      case 'E': return {
        titel: '✍️ القسم هـ — الكتابة',
        intro: 'سترى **نموذجاً كاملاً** (Mustertext) من إنتاج مستوى B2 ناجح، مع تحليل البنية. اقرأ النموذج، لاحظ كيف يستعمل الروابط و الأسلوب، ثم اكتب أنت نصّاً مشابهاً.',
        tipp: '💡 اكتب بخطّك بالورقة أوّلاً — ثم انسخه على الكمبيوتر. هذا يُحضّرك ليوم الامتحان (ورقة و قلم). استعمل زرّ الترجمة لفهم النموذج.'
      };
      default: return { titel: '', intro: '', tipp: '' };
    }
  }

  // ─── ترجمة Lernziele للعربيّة (باستدعاء واحد) ───
  readonly zieleArabic = signal<string | null>(null);
  readonly zieleLoading = signal(false);

  async translateZiele() {
    const s = this.sitzung();
    if (!s || this.zieleLoading()) return;
    if (this.zieleArabic()) { this.zieleArabic.set(null); return; }
    if (!this.claude.available()) {
      this.openAsk('أهداف الدرس', s.lernziele.join('\n'));
      return;
    }
    this.zieleLoading.set(true);
    try {
      const text = s.lernziele.map((z, i) => `${i + 1}. ${z}`).join('\n');
      const prompt = 'ترجم أهداف الدرس التالية إلى العربيّة ترجمة واضحة و مباشرة (قائمة مرقّمة). أعطني الترجمة فقط بلا مقدّمات.';
      const answer = await this.claude.ask(text, prompt);
      if (answer) this.zieleArabic.set(answer);
    } finally {
      this.zieleLoading.set(false);
    }
  }
}
