import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

/**
 * 📰 NewsService — يجلب آخر أخبار التقنية الألمانية من heise.de.
 *
 * 🎯 لماذا rss2json.com كـ proxy؟
 *   - heise.de's RSS مباشرة تُعطي CORS error في المتصفح.
 *   - rss2json.com يقرأ الـ RSS من جهتها و يُعيده JSON مع CORS صحيح.
 *   - مجاني، لا يحتاج API key، 10,000 طلب/يوم.
 *
 * 🎯 لماذا يُرجع Observable بدل Promise؟
 *   - HttpClient في Angular يُرجع Observable بشكل افتراضي.
 *   - يدعم cancellation، retry، operators (map, filter, etc.).
 */

/** شكل عنصر واحد من الاستجابة. */
export interface NewsArticle {
  title: string;
  description: string;       // نظيف من HTML tags
  link: string;
  pubDate: string;
}

/** الشكل الخام من rss2json (نُحوّله لـ NewsArticle نظيف). */
interface Rss2JsonResponse {
  status: 'ok' | 'error';
  items?: Array<{
    title: string;
    description: string;
    link: string;
    pubDate: string;
  }>;
}

@Injectable({ providedIn: 'root' })
export class NewsService {
  private http = inject(HttpClient);

  /**
   * heise.de هو أكبر موقع تقني ألماني — أخبار يومية متعددة.
   * يمكن استبداله بـ feed آخر (golem.de, t3n.de, ...) لو أردت.
   */
  private readonly RSS_FEED = 'https://www.heise.de/rss/heise-atom.xml';
  private readonly PROXY = 'https://api.rss2json.com/v1/api.json';

  /**
   * يجلب أحدث المقالات. نُرجع أول 10 لتنوّع الاختيار.
   *
   * 🎯 RxJS operators:
   *   .pipe() + map() = نُحوّل الـ response قبل ما يصل للـ subscriber.
   *   هذا نمط "Adapter": نستقبل شكل، نُرجع شكلاً آخر أنظف.
   */
  fetchLatest(): Observable<NewsArticle[]> {
    const url = `${this.PROXY}?rss_url=${encodeURIComponent(this.RSS_FEED)}`;

    return this.http.get<Rss2JsonResponse>(url).pipe(
      map(response => {
        if (response.status !== 'ok' || !response.items) {
          throw new Error('Failed to fetch news');
        }
        // نأخذ أول 10 و ننظّف الـ description من HTML
        return response.items.slice(0, 10).map(item => ({
          title: this.stripHtml(item.title),
          description: this.stripHtml(item.description),
          link: item.link,
          pubDate: item.pubDate,
        }));
      })
    );
  }

  /**
   * يُزيل HTML tags من نص. للأخبار العادية يكفي.
   *
   * 🎯 ملاحظة أمنية: في تطبيق إنتاجي حقيقي، نستخدم
   * DOMPurify لتطهير أعمق. هنا regex بسيط كافٍ.
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, ' ')           // إزالة كل tag
      .replace(/&nbsp;/g, ' ')            // الفراغ غير القابل للكسر
      .replace(/&amp;/g, '&')             // &
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')               // مسافات متعددة → واحدة
      .trim();
  }
}
