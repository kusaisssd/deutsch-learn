import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, map, catchError, shareReplay } from 'rxjs';

/** اللغات المدعومة في هذا التطبيق */
export type TargetLang = 'ar' | 'en';

/** شكل الاستجابة من MyMemory (نحتاج هذه الحقول فقط) */
interface MyMemoryResponse {
  responseData: {
    translatedText: string;
  };
  responseStatus: number;
}

/**
 * TranslationService — يترجم كلمات/جمل ألمانية إلى عربي أو إنجليزي.
 *
 * يستخدم MyMemory API المجاني (لا يحتاج مفتاح):
 *   https://api.mymemory.translated.net/get?q=Hallo&langpair=de|ar
 *
 * ✨ ميزة مهمة: cache في الذاكرة
 *   لو سأل المستخدم نفس الكلمة مرتين، لا نستدعي API ثانية.
 *   نحتفظ بالـ Observable نفسه عبر shareReplay كي تشترك الطلبات.
 *
 * مقابل في .NET: HttpClient + IMemoryCache
 */
@Injectable({ providedIn: 'root' })
export class TranslationService {
  private http = inject(HttpClient);

  /**
   * Cache: المفتاح = "ar:Hallo" أو "en:Hallo"، القيمة = Observable للنتيجة.
   * نستخدم Map لأداء O(1).
   */
  private cache = new Map<string, Observable<string>>();

  /**
   * ترجم كلمة/جملة من الألمانية إلى اللغة المختارة.
   *
   * يُرجع Observable لأن HttpClient في Angular يستخدم Observables.
   * (سنشترك فيه subscribe في الـ component.)
   *
   * @param text     النص الألماني
   * @param to       لغة الهدف ('ar' أو 'en')
   * @returns        Observable<string> فيه الترجمة
   */
  translate(text: string, to: TargetLang): Observable<string> {
    const cleaned = text.trim();
    if (!cleaned) return of('');   // نص فارغ → نُرجع فوراً

    // مفتاح الـ cache
    const key = `${to}:${cleaned.toLowerCase()}`;

    // لو موجود في الـ cache، نُرجعه مباشرة (لا نستدعي API)
    const cached = this.cache.get(key);
    if (cached) return cached;

    /**
     * بناء URL.
     * encodeURIComponent مهم: يحوّل الأحرف الخاصة (مثل المسافات) لصيغة URL.
     */
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleaned)}&langpair=de|${to}`;

    /**
     * Pipeline من العمليات على الـ Observable:
     *   1. map  → نأخذ فقط responseData.translatedText من الاستجابة
     *   2. catchError → لو فشل الطلب، نُرجع رسالة بدل تكسير التطبيق
     *   3. shareReplay(1) → النتيجة الأولى تُشارك بين كل المشتركين
     *                       (هذا هو "الـ cache" الفعلي للـ Observable)
     */
    const request$ = this.http.get<MyMemoryResponse>(url).pipe(
      map(res => res.responseData?.translatedText || '—'),
      catchError((err) => {
        console.error('فشل الترجمة:', err);
        return of('فشلت الترجمة');
      }),
      shareReplay(1),
    );

    this.cache.set(key, request$);
    return request$;
  }

  /** مسح الـ cache (مفيد لو أردنا زر "إعادة تحديث") */
  clearCache(): void {
    this.cache.clear();
  }
}
