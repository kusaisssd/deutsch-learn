import { effect, inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ClaudeAskResult, ClaudeDeepResult, ClaudeLookupResult } from '../models/claude-lookup.model';
import { SyncService } from './sync';

const CACHE_KEY = 'deutsch-learn:claude-lookup-cache';
const MAX_CACHE = 500; // اقتصار حجم الـcache على 500 كلمة

/**
 * ClaudeLookupService — يستدعي /api/claude-lookup (خادم Vercel) و يخزّن النتائج
 * محلياً. المفتاح ANTHROPIC_API_KEY لا يمرّ أبداً عبر المتصفّح.
 */
const NO_PASS_ERROR = 'AI مقفَل: اضبط passphrase من صفحة إعدادات القاموس أوّلاً.';

@Injectable({ providedIn: 'root' })
export class ClaudeLookupService {
  private http = inject(HttpClient);
  private sync = inject(SyncService);

  /** هل خدمات الـ AI متاحة؟ (تتطلّب passphrase) */
  readonly available = () => this.sync.hasPassphrase();

  /** header يحمل الـ passphrase — كل استدعاء AI يجب أن يحمله */
  private authHeaders(): HttpHeaders {
    return new HttpHeaders({ 'x-sync-key': this.sync.passphrase() });
  }

  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _result = signal<ClaudeLookupResult | null>(null);
  private readonly _cache = signal<Record<string, ClaudeLookupResult>>(this.loadCache());

  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly result = this._result.asReadonly();

  /** يعرض ما إذا كانت الكلمة موجودة في الـcache */
  getCached(word: string): ClaudeLookupResult | null {
    return this._cache()[word.toLowerCase()] ?? null;
  }

  /** كل الكلمات المُخبّأة */
  cachedEntries(): ClaudeLookupResult[] {
    return Object.values(this._cache());
  }

  /** يمسح النتيجة الحالية (عند تغيّر البحث) */
  clearResult(): void {
    this._result.set(null);
    this._error.set(null);
  }

  /**
   * يجلب شرح Claude للكلمة. يستخدم الـ cache إن أمكن. غير متزامن.
   */
  async lookup(word: string): Promise<void> {
    const key = word.trim().toLowerCase();
    if (!key) return;

    // 1) cache hit → فوري (يعمل حتى بلا passphrase — البيانات مخزّنة محلياً)
    const cached = this._cache()[key];
    if (cached) {
      this._result.set(cached);
      this._error.set(null);
      return;
    }

    // 2) شبكة → يجب وجود passphrase
    if (!this.available()) { this._error.set(NO_PASS_ERROR); return; }

    this._loading.set(true);
    this._error.set(null);
    this._result.set(null);

    try {
      const res = await firstValueFrom(
        this.http.get<ClaudeLookupResult>('/api/claude-lookup', {
          params: { word: word.trim() },
          headers: this.authHeaders(),
        }),
      );
      this._result.set(res);
      this._cache.update((c) => this.addToCache(c, key, res));
    } catch (err) {
      const e = err as HttpErrorResponse;
      const msg = e.error?.error ?? e.message ?? 'حدث خطأ في الاتصال بـ Claude';
      this._error.set(msg);
    } finally {
      this._loading.set(false);
    }
  }

  /** يجلب شرحاً أعمق (لا cache — كل استدعاء يستهلك تكلفة صغيرة) */
  async lookupDeep(word: string): Promise<ClaudeDeepResult | null> {
    if (!word.trim()) return null;
    if (!this.available()) { this._error.set(NO_PASS_ERROR); return null; }
    try {
      const res = await firstValueFrom(
        this.http.get<ClaudeDeepResult>('/api/claude-lookup', {
          params: { word: word.trim(), mode: 'deep' },
          headers: this.authHeaders(),
        }),
      );
      return res;
    } catch (err) {
      const e = err as HttpErrorResponse;
      this._error.set(e.error?.error ?? e.message ?? 'خطأ في الاتصال');
      return null;
    }
  }

  /**
   * يطرح سؤالاً حرّاً على Claude حول كلمة/جملة، و يُرجع نصّ الجواب.
   * لا يُخبَّأ (كل سؤال مخصّص).
   */
  async ask(word: string, question: string): Promise<string | null> {
    const w = word.trim();
    const q = question.trim();
    if (!w || q.length < 2) return null;
    if (!this.available()) { this._error.set(NO_PASS_ERROR); return null; }
    try {
      const res = await firstValueFrom(
        this.http.get<ClaudeAskResult>('/api/claude-lookup', {
          params: { word: w, mode: 'ask', q },
          headers: this.authHeaders(),
        }),
      );
      return res?.answer ?? null;
    } catch (err) {
      const e = err as HttpErrorResponse;
      this._error.set(e.error?.error ?? e.message ?? 'خطأ في الاتصال');
      return null;
    }
  }

  constructor() {
    effect(() => this.saveCache(this._cache()));
  }

  private addToCache(
    c: Record<string, ClaudeLookupResult>,
    key: string,
    res: ClaudeLookupResult,
  ): Record<string, ClaudeLookupResult> {
    const next = { ...c, [key]: res };
    const keys = Object.keys(next);
    if (keys.length > MAX_CACHE) {
      // نحذف الأقدم (نستفيد من ترتيب مفاتيح الكائن — إدراج FIFO)
      const overflow = keys.length - MAX_CACHE;
      for (let i = 0; i < overflow; i++) delete next[keys[i]];
    }
    return next;
  }

  private loadCache(): Record<string, ClaudeLookupResult> {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, ClaudeLookupResult>) : {};
    } catch { return {}; }
  }
  private saveCache(c: Record<string, ClaudeLookupResult>): void {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); }
    catch (e) { console.warn('Failed to save Claude cache:', e); }
  }
}
