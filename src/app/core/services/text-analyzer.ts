import { effect, inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SavedLesson, TextAnalysis } from '../models/text-analysis.model';
import { SyncService } from './sync';

const STORAGE_KEY = 'deutsch-learn:text-lessons';
const MAX_SAVED = 50;

/**
 * TextAnalyzerService — يحوّل نصّاً ألمانياً إلى درس منظّم عبر Claude
 * (/api/claude-lookup?mode=analyze) و يحفظ الدروس محلياً.
 */
@Injectable({ providedIn: 'root' })
export class TextAnalyzerService {
  private http = inject(HttpClient);
  private sync = inject(SyncService);

  /** الدروس المحفوظة محلياً (الأحدث أوّلاً) */
  private readonly _saved = signal<SavedLesson[]>(this.load());
  readonly saved = this._saved.asReadonly();

  /** حالة التحليل */
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly available = () => this.sync.hasPassphrase();

  constructor() {
    effect(() => this.save(this._saved()));
  }

  /** استدعاء AI لتحليل نصّ. يُرجع التحليل أو null عند الفشل. */
  async analyze(text: string): Promise<TextAnalysis | null> {
    const t = text.trim();
    if (t.length < 50 || t.length > 5000) {
      this._error.set('النصّ يجب أن يكون بين 50 و 5000 حرف.');
      return null;
    }
    if (!this.available()) {
      this._error.set('خدمة AI مقفلة. اضبط passphrase من إعدادات القاموس.');
      return null;
    }

    this._loading.set(true);
    this._error.set(null);
    try {
      const headers = new HttpHeaders({ 'x-sync-key': this.sync.passphrase() });
      const res = await firstValueFrom(
        this.http.get<TextAnalysis>('/api/claude-lookup', {
          params: { word: t, mode: 'analyze' },
          headers,
        }),
      );
      return res;
    } catch (err) {
      const e = err as HttpErrorResponse;
      this._error.set(e.error?.error ?? e.message ?? 'فشل التحليل.');
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  /** يحفظ درساً جديداً و يُرجع الـ id */
  saveLesson(originaltext: string, analyse: TextAnalysis): string {
    const id = (crypto.randomUUID?.() ?? String(Date.now()));
    const titel = this.makeTitle(originaltext, analyse);
    const lesson: SavedLesson = {
      id, erstelltAm: Date.now(),
      originaltext, titel, analyse,
    };
    this._saved.update(list => [lesson, ...list].slice(0, MAX_SAVED));
    return id;
  }

  getLesson(id: string): SavedLesson | null {
    return this._saved().find(l => l.id === id) ?? null;
  }

  deleteLesson(id: string) {
    this._saved.update(list => list.filter(l => l.id !== id));
  }

  clearAll() { this._saved.set([]); }

  private makeTitle(text: string, a: TextAnalysis): string {
    const first = text.trim().split(/[.!?]/)[0]?.slice(0, 60) ?? '';
    return first || a.textsorte || 'Textlektion';
  }

  private load(): SavedLesson[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as SavedLesson[]) : [];
    } catch { return []; }
  }
  private save(list: SavedLesson[]) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }
    catch { /* quota */ }
  }
}
