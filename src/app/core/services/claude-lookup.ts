import { effect, inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ClaudeLookupResult } from '../models/claude-lookup.model';

const CACHE_KEY = 'deutsch-learn:claude-lookup-cache';
const MAX_CACHE = 500; // اقتصار حجم الـcache على 500 كلمة

/**
 * ClaudeLookupService — يستدعي /api/claude-lookup (خادم Vercel) و يخزّن النتائج
 * محلياً. المفتاح ANTHROPIC_API_KEY لا يمرّ أبداً عبر المتصفّح.
 */
@Injectable({ providedIn: 'root' })
export class ClaudeLookupService {
  private http = inject(HttpClient);

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

    // 1) cache hit → فوري
    const cached = this._cache()[key];
    if (cached) {
      this._result.set(cached);
      this._error.set(null);
      return;
    }

    // 2) جلب من الخادم
    this._loading.set(true);
    this._error.set(null);
    this._result.set(null);

    try {
      const res = await firstValueFrom(
        this.http.get<ClaudeLookupResult>('/api/claude-lookup', {
          params: { word: word.trim() },
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
