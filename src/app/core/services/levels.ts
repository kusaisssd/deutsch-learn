import { Injectable, signal } from '@angular/core';
import { Level } from '../models/level.model';

/**
 * خدمة المستويات.
 *
 * المسؤوليات:
 * - تخزين قائمة المستويات (A1, A2, B1, B2).
 * - توفير وصول للقائمة عبر signal (للقراءة فقط من الخارج).
 *
 * شبيه بـ ASP.NET:
 *   public interface ILevelsRepository {
 *     IReadOnlyList<Level> GetAll();
 *   }
 *
 * لماذا Singleton (providedIn: 'root')؟
 *   البيانات ثابتة و قابلة للمشاركة بين كل الصفحات → نسخة واحدة كافية.
 */
@Injectable({ providedIn: 'root' })
export class LevelsService {
  /**
   * قائمة المستويات.
   *
   * نستخدم `signal` كي تكون البيانات "تفاعلية":
   * أي مكان يستخدم levels() في الـ template سيُحدَّث تلقائياً
   * لو تغيرت القائمة (مثلاً لو جلبناها لاحقاً من API).
   *
   * private + readonly: لا أحد من الخارج يستطيع تعديل القائمة مباشرة.
   * كي يقرأها أحد من الخارج، نعرّضها عبر getter آمن (asReadonly).
   */
  private readonly _levels = signal<Level[]>([
    {
      code: 'A1',
      title: 'Beginner',
      description: 'Basic everyday sentences and vocabulary',
      color: 'bg-green-500',
    },
    {
      code: 'A2',
      title: 'Elementary',
      description: 'Simple situations and common expressions',
      color: 'bg-teal-500',
    },
    {
      code: 'B1',
      title: 'Intermediate',
      description: 'Understanding texts and expressing opinions',
      color: 'bg-blue-500',
    },
    {
      code: 'B2',
      title: 'Upper Intermediate',
      description: 'Complex discussions and specialized texts',
      color: 'bg-purple-500',
    },
  ]);

  /**
   * نسخة للقراءة فقط من الـ signal.
   * الـ component لا يستطيع تعديلها (لا توجد .set أو .update).
   * هذا يحمي البيانات من تعديل غير مقصود.
   */
  readonly levels = this._levels.asReadonly();
}
