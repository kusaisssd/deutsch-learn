import { Injectable, signal } from '@angular/core';

/**
 * SpeechService — يلفّ Web Speech API لتحويل النص لكلام.
 *
 * Web Speech API مدمج في المتصفحات الحديثة (Chrome, Edge, Firefox, Safari).
 * لا يحتاج مكتبة أو API key — يعمل مباشرة.
 *
 * مقابل في .NET: System.Speech.Synthesis.SpeechSynthesizer
 * لكن هنا يستخدم محرّك الكلام الموجود في المتصفح/النظام.
 */
@Injectable({ providedIn: 'root' })
export class SpeechService {
  /** هل المتصفح يدعم الكلام؟ */
  readonly isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  /** هل يقرأ الآن؟ (للأزرار: نظهر "إيقاف" بدل "تشغيل") */
  private readonly _isSpeaking = signal(false);
  readonly isSpeaking = this._isSpeaking.asReadonly();

  /** الأصوات الألمانية المتاحة في المتصفح */
  private readonly _germanVoices = signal<SpeechSynthesisVoice[]>([]);
  readonly germanVoices = this._germanVoices.asReadonly();

  constructor() {
    if (!this.isSupported) return;

    /**
     * الأصوات تُحمَّل بشكل غير متزامن (async) في بعض المتصفحات.
     * نستمع لحدث voiceschanged ثم نُصفّي الأصوات الألمانية.
     */
    const loadVoices = () => {
      const all = speechSynthesis.getVoices();
      const german = all.filter(v => v.lang.startsWith('de'));
      this._germanVoices.set(german);
    };

    loadVoices();   // محاولة فورية
    speechSynthesis.addEventListener('voiceschanged', loadVoices);
  }

  /**
   * نطق نص بلغة محدّدة.
   *
   * @param text  النص للقراءة
   * @param rate  السرعة (0.5 = بطيء، 1.0 = عادي، 2.0 = سريع)
   * @param voice صوت محدد (اختياري — لو لم يُمرّر نختار تلقائياً صوتاً مطابقاً للغة)
   * @param lang  لغة BCP47 مثل 'de-DE' (افتراضي) أو 'ar-SA' (للعربية الفصحى)
   */
  speak(text: string, rate: number = 1.0, voice?: SpeechSynthesisVoice, lang: string = 'de-DE'): void {
    if (!this.isSupported || !text.trim()) return;

    // أوقف أي قراءة سابقة كي لا تتراكم
    this.stop();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = Math.max(0.5, Math.min(2.0, rate));   // clamp

    if (voice) {
      utterance.voice = voice;
    } else if (!lang.startsWith('de')) {
      // اختر تلقائياً صوتاً يطابق اللغة — مهم لئلا يقرأ صوت ألماني نصاً عربياً.
      const prefix = lang.split('-')[0];
      const all = speechSynthesis.getVoices();
      const match = all.find(v => v.lang.startsWith(lang)) ?? all.find(v => v.lang.startsWith(prefix));
      if (match) utterance.voice = match;
    }

    utterance.onstart = () => this._isSpeaking.set(true);
    utterance.onend = () => this._isSpeaking.set(false);
    utterance.onerror = () => this._isSpeaking.set(false);

    speechSynthesis.speak(utterance);
  }

  /** إيقاف القراءة الحالية فوراً */
  stop(): void {
    if (!this.isSupported) return;
    speechSynthesis.cancel();
    this._isSpeaking.set(false);
  }
}
