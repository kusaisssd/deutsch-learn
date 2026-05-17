import { Injectable, signal } from '@angular/core';

/**
 * 🎙️ SpeechRecognitionService
 *
 * يلفّ Web Speech API الخاصة بالتعرّف على الكلام (الجزء الآخر من
 * SpeechSynthesis التي استخدمناها في الـ Reader).
 *
 * Web Speech Recognition تحوّل صوت المستخدم لنص (Speech-to-Text).
 * تعمل في Chrome/Edge فقط بشكل موثوق.
 *
 * 🎯 تحديات تقنية معالَجة هنا:
 *   1. TypeScript لا يعرف SpeechRecognition (vendor-prefixed قديم)
 *      → نُعرّف أنواعاً مبسّطة بأنفسنا.
 *   2. الـ API event-based غير متزامن → نستخدم signals.
 *   3. الـ API يحتاج صلاحية ميكروفون → المتصفح يطلبها عند البدء.
 */

// ─────────────────────────────────────────────
// أنواع TypeScript مبسّطة للـ Web Speech Recognition
// (نحتاجها لأن الـ API ليس له types رسمية في DOM)
// ─────────────────────────────────────────────

interface SpeechRecognitionEvent {
  results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }>>;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

// المُنشئ الذي توفّره المتصفحات
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

@Injectable({ providedIn: 'root' })
export class SpeechRecognitionService {
  /**
   * نجد الـ constructor المتاح:
   *   - SpeechRecognition (المعيار)
   *   - webkitSpeechRecognition (Chrome/Safari قديماً)
   *
   * نخزّن النوع في متغيّر مرة واحدة لاستخدامه لاحقاً.
   */
  private readonly Recognition: SpeechRecognitionConstructor | undefined =
    typeof window !== 'undefined'
      ? ((window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor })
          .SpeechRecognition ??
        (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionConstructor })
          .webkitSpeechRecognition)
      : undefined;

  /** هل المتصفح يدعم Speech Recognition؟ */
  readonly isSupported = !!this.Recognition;

  // ───────── State signals (يقرؤها الـ component) ─────────

  /** هل نحن نستمع حالياً؟ (لتغيير شكل زر الـ mic) */
  private readonly _isListening = signal(false);
  readonly isListening = this._isListening.asReadonly();

  /** آخر نص تعرّفنا عليه (يُحدَّث عند نهاية الجلسة) */
  private readonly _lastTranscript = signal<string>('');
  readonly lastTranscript = this._lastTranscript.asReadonly();

  /** آخر خطأ (لعرض تنبيه إذا حدث) */
  private readonly _error = signal<string | null>(null);
  readonly error = this._error.asReadonly();

  /** نسخة Recognition النشطة (للإيقاف عند الحاجة) */
  private currentInstance: SpeechRecognitionInstance | null = null;

  /**
   * بدء الاستماع.
   *
   * @param lang كود اللغة (مثل 'de-DE' للألمانية، 'en-US' للإنجليزية)
   *
   * المتصفح سيطلب صلاحية الميكروفون أول مرة فقط.
   */
  start(lang: string = 'de-DE'): void {
    if (!this.Recognition) {
      this._error.set('Speech recognition not supported in this browser');
      return;
    }

    // أوقف أي جلسة سابقة كي لا تتراكم
    this.stop();

    const rec = new this.Recognition();
    rec.lang = lang;
    rec.continuous = false;       // ينتهي تلقائياً عند سكوت قصير
    rec.interimResults = false;   // نريد النتيجة النهائية فقط
    rec.maxAlternatives = 1;      // نريد التخمين الأفضل فقط

    // ─── handlers (event-driven) ───
    rec.onstart = () => {
      this._isListening.set(true);
      this._error.set(null);
      this._lastTranscript.set('');
    };

    rec.onresult = (event) => {
      // النتيجة موجودة في events.results[0][0].transcript
      const result = event.results[0]?.[0];
      if (result) {
        this._lastTranscript.set(result.transcript);
      }
    };

    rec.onerror = (event) => {
      // الأخطاء الشائعة:
      //   'no-speech'  → لم يسمع صوتاً
      //   'not-allowed' → المستخدم رفض صلاحية الميكروفون
      //   'network'    → مشكلة اتصال
      this._error.set(this.friendlyError(event.error));
      this._isListening.set(false);
    };

    rec.onend = () => {
      this._isListening.set(false);
      this.currentInstance = null;
    };

    this.currentInstance = rec;

    try {
      rec.start();
    } catch (e) {
      this._error.set('Failed to start microphone');
      this._isListening.set(false);
    }
  }

  /** إيقاف الاستماع يدوياً (يُطلق onend) */
  stop(): void {
    if (this.currentInstance) {
      try {
        this.currentInstance.stop();
      } catch {
        // ignore: قد يكون انتهى بالفعل
      }
    }
  }

  /** يمسح آخر نتيجة (نستخدمها عند بدء دور جديد) */
  clearResult(): void {
    this._lastTranscript.set('');
    this._error.set(null);
  }

  /** يحوّل رسائل الخطأ التقنية إلى رسائل مفهومة للمستخدم */
  private friendlyError(code: string): string {
    const isLocalhost =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1');
    const isHttps =
      typeof window !== 'undefined' && window.location.protocol === 'https:';

    switch (code) {
      case 'no-speech':
        return "Didn't catch that — please try again and speak clearly.";
      case 'not-allowed':
      case 'service-not-allowed':
        return 'Microphone permission denied. Click the 🔒 icon in the address bar to enable it.';
      case 'network':
        // رسالة أطول و أوضح حسب البيئة
        if (!isHttps && !isLocalhost) {
          return 'Network error — speech recognition requires HTTPS.';
        }
        return (
          'Network error connecting to speech service. ' +
          'Possible causes: (1) browser language pack not installed, ' +
          '(2) VPN/firewall blocking, (3) try the deployed HTTPS site instead of localhost.'
        );
      case 'language-not-supported':
        return 'This language is not installed on your system. Install the German language pack in Windows Settings → Time & Language → Speech.';
      case 'audio-capture':
        return 'No microphone detected. Check that your mic is connected.';
      case 'aborted':
        return ''; // المستخدم أوقف، لا رسالة
      default:
        return `Recognition error: ${code}`;
    }
  }
}
