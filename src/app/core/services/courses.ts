import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Course } from '../models/course.model';

/**
 * CoursesService — يحمّل الكورسات المنهجية من courses.json.
 *
 * نفس نمط الـ services الأخرى (Conversations, CafeCards):
 *   - signal خاص للبيانات + signal للقراءة فقط
 *   - loaded flag
 *   - helpers للبحث (courseById, lektion lookup)
 */
@Injectable({ providedIn: 'root' })
export class CoursesService {
  private http = inject(HttpClient);

  private readonly _courses = signal<Course[]>([]);
  private readonly _loaded = signal(false);

  readonly courses = this._courses.asReadonly();
  readonly loaded = this._loaded.asReadonly();

  /** كورس واحد عبر id */
  courseById(id: string) {
    return computed(() => this._courses().find(c => c.id === id));
  }

  /**
   * درس واحد داخل كورس عبر lektionId.
   * يُرجع { course, lektion, index } — نحتاج index لمعرفة الدرس السابق/التالي
   * و حالة القفل.
   */
  lektionLookup(courseId: string, lektionId: string) {
    return computed(() => {
      const course = this._courses().find(c => c.id === courseId);
      if (!course) return null;
      const index = course.lektionen.findIndex(l => l.id === lektionId);
      if (index === -1) return null;
      return {
        course,
        lektion: course.lektionen[index],
        index,
        prev: course.lektionen[index - 1] ?? null,
        next: course.lektionen[index + 1] ?? null,
      };
    });
  }

  constructor() {
    this.http.get<Course[]>('/data/courses.json').subscribe({
      next: (data) => {
        this._courses.set(data);
        this._loaded.set(true);
      },
      error: (err) => {
        console.error('Failed to load courses:', err);
        this._loaded.set(true);
      },
    });
  }
}
