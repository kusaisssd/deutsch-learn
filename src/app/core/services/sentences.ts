import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Sentence } from '../models/sentence.model';
import { LevelCode } from '../models/level.model';

/**
 * خدمة الجمل.
 *
 * المسؤوليات:
 *   - تحميل sentences.json من السيرفر مرة واحدة (cache).
 *   - توفير getter للجمل بمستوى معين.
 *   - توفير getter لجملة واحدة بـ id.
 *
 * شبيهة بـ Repository في ASP.NET:
 *   public interface ISentencesRepository {
 *     Task LoadAsync();
 *     IEnumerable<Sentence> GetByLevel(string level);
 *     Sentence? GetById(int id);
 *   }
 */
@Injectable({ providedIn: 'root' })
export class SentencesService {
  /** نحقن HttpClient (مثل HttpClient في .NET تماماً) */
  private http = inject(HttpClient);

  /**
   * تخزين الجمل بعد تحميلها.
   * private = لا يستطيع أحد من الخارج تغييرها مباشرة.
   */
  private readonly _sentences = signal<Sentence[]>([]);

  /** signal يخبرنا هل تم التحميل أم لا */
  private readonly _loaded = signal(false);

  /** نسخة للقراءة فقط للخارج */
  readonly sentences = this._sentences.asReadonly();
  readonly loaded = this._loaded.asReadonly();

  /**
   * يحمّل الجمل من JSON (يُستدعى تلقائياً في البناء).
   *
   * subscribe = "اشترك في الـ Observable و نفّذ هذا الـ callback عند وصول النتيجة".
   * مشابه لـ await لكن للـ Observables.
   *
   * مقابل في .NET:
   *   var data = await _http.GetFromJsonAsync<List<Sentence>>("data/sentences.json");
   *   _sentences = data ?? new();
   */
  constructor() {
    this.http.get<Sentence[]>('/data/sentences.json').subscribe({
      next: (data) => {
        this._sentences.set(data);   // ← تحديث الـ signal بالبيانات
        this._loaded.set(true);
      },
      error: (err) => {
        console.error('فشل تحميل الجمل:', err);
        this._loaded.set(true);      // ← حتى لو فشل، نضعها true لمنع تعليق الـ UI
      },
    });
  }

  /**
   * إرجاع جمل مستوى معين.
   *
   * نستخدم computed() = signal "محسوب" يعتمد على signals أخرى.
   * يُعاد حسابه تلقائياً لما يتغير ما يعتمد عليه.
   *
   * هذا يقابل في C# مفهوم خاصية محسوبة:
   *   public IEnumerable<Sentence> A1Sentences => _all.Where(s => s.Level == "A1");
   */
  sentencesByLevel(level: LevelCode) {
    return computed(() =>
      this._sentences().filter(s => s.level === level)
    );
  }

  /**
   * إرجاع جملة واحدة بـ id (للـ Practice page لاحقاً).
   */
  sentenceById(id: number) {
    return computed(() =>
      this._sentences().find(s => s.id === id)
    );
  }
}
