import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, map, catchError, shareReplay } from 'rxjs';

/** اللغات المدعومة في هذا التطبيق */
export type TargetLang = 'ar' | 'en';

/**
 * شكل الاستجابة من MyMemory (نأخذ منها فقط ما نحتاج).
 *
 * 🆕 'matches' هي مصفوفة فيها ترجمات بديلة للكلمة/الجملة.
 *    مفيدة جداً للكلمات متعددة المعاني (مثل "Bank" = bank/bench/shore).
 */
interface MyMemoryResponse {
  responseData: {
    translatedText: string;
  };
  responseStatus: number;
  matches?: Array<{
    translation: string;
    quality: string | number;
    /** قد توجد حقول أخرى مثل segment, reference, ... — نتجاهلها */
  }>;
}

@Injectable({ providedIn: 'root' })
export class TranslationService {
  private http = inject(HttpClient);

  /**
   * Cache واحد للترجمات (string => translation primary).
   * مفتاح: 'ar:Hallo' أو 'en:Hallo'.
   */
  private cacheSingle = new Map<string, Observable<string>>();

  /**
   * Cache منفصل للترجمات المتعددة (string => array of meanings).
   * نفصل cache المتعددة عن الواحدة لأن الـ shape مختلفة.
   */
  private cacheMany = new Map<string, Observable<string[]>>();

  /**
   * ترجمة واحدة (الترجمة الأساسية فقط).
   * تُستخدم للنص الطويل (الجملة كاملة).
   */
  translate(text: string, to: TargetLang): Observable<string> {
    const cleaned = text.trim();
    if (!cleaned) return of('');

    const key = `${to}:${cleaned.toLowerCase()}`;
    const cached = this.cacheSingle.get(key);
    if (cached) return cached;

    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleaned)}&langpair=de|${to}`;

    const request$ = this.http.get<MyMemoryResponse>(url).pipe(
      map(res => res.responseData?.translatedText || '—'),
      catchError((err) => {
        console.error('Translation failed:', err);
        return of('Translation failed');
      }),
      shareReplay(1),
    );

    this.cacheSingle.set(key, request$);
    return request$;
  }

  /**
   * 🆕 ترجمة كلمة مع كل معانيها البديلة.
   *
   * المنطق:
   *   1. نستدعي MyMemory مع نفس الطلب
   *   2. نأخذ الترجمة الأساسية + كل الـ matches
   *   3. نُنظّفها (lowercase + trim)
   *   4. نُزيل المكررات (Set)
   *   5. نُرجع أعلى 5 ترتيباً بالـ quality
   *
   * مفيدة للكلمات الواحدة في الـ Reader (Bank = bank / bench / shore...)
   */
  translateMany(text: string, to: TargetLang): Observable<string[]> {
    const cleaned = text.trim();
    if (!cleaned) return of([]);

    const key = `${to}:${cleaned.toLowerCase()}`;
    const cached = this.cacheMany.get(key);
    if (cached) return cached;

    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleaned)}&langpair=de|${to}`;

    const request$ = this.http.get<MyMemoryResponse>(url).pipe(
      map(res => this.extractUniqueMeanings(res)),
      catchError((err) => {
        console.error('Translation failed:', err);
        return of<string[]>([]);
      }),
      shareReplay(1),
    );

    this.cacheMany.set(key, request$);
    return request$;
  }

  /**
   * من الاستجابة الخام، استخرج قائمة معاني فريدة مرتبة بالـ quality.
   *
   * 🎯 خوارزمية:
   *   1. ابدأ بالترجمة الأساسية (translatedText)
   *   2. أضف كل matches إن وجدت
   *   3. نظّف (lowercase, trim)
   *   4. أزل المكررات (Set keeps insertion order)
   *   5. أرجع أعلى 5
   */
  private extractUniqueMeanings(res: MyMemoryResponse): string[] {
    // نجمع كل المرشحين مع الـ quality (للترتيب)
    interface Candidate { text: string; quality: number; }
    const candidates: Candidate[] = [];

    // الترجمة الأساسية (الأعلى ثقة عادة)
    const primary = res.responseData?.translatedText?.trim();
    if (primary) candidates.push({ text: primary, quality: 100 });

    // كل الـ matches
    for (const m of res.matches ?? []) {
      const text = (m.translation || '').trim();
      if (!text) continue;
      const quality = typeof m.quality === 'number'
        ? m.quality
        : parseInt(m.quality, 10) || 0;
      candidates.push({ text, quality });
    }

    // رتّب من الأعلى للأقل quality
    candidates.sort((a, b) => b.quality - a.quality);

    // أزل المكررات (case-insensitive) و احتفظ بالترتيب
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const c of candidates) {
      const lower = c.text.toLowerCase();
      if (seen.has(lower)) continue;
      seen.add(lower);
      unique.push(c.text);
      if (unique.length >= 5) break;
    }

    return unique;
  }

  /** مسح كل الـ caches */
  clearCache(): void {
    this.cacheSingle.clear();
    this.cacheMany.clear();
  }
}
