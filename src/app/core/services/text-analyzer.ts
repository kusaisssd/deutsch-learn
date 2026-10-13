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
    if (t.length < 50 || t.length > 2500) {
      this._error.set('النصّ يجب أن يكون بين 50 و 2500 حرف (تفادياً لمهلة الخادم).');
      return null;
    }
    if (!this.available()) {
      this._error.set('خدمة AI مقفلة. اضبط passphrase من إعدادات القاموس.');
      return null;
    }

    this._loading.set(true);
    this._error.set(null);
    try {
      const headers = new HttpHeaders({ 'x-sync-key': this.sync.passphrase(), 'content-type': 'application/json' });
      // POST بدل GET: النصّ قد يصل 5000 حرف، أكبر من حدود URL
      const res = await firstValueFrom(
        this.http.post<TextAnalysis>('/api/claude-lookup', { word: t, mode: 'analyze' }, { headers }),
      );
      // تحقّق أن الـ response يحمل البنية المتوقّعة
      if (!res || typeof res !== 'object' || !Array.isArray((res as TextAnalysis).schluesselwoerter)) {
        this._error.set('استجابة AI غير متوقّعة. حاول مرّة أخرى بنصّ أقصر.');
        return null;
      }
      return res;
    } catch (err) {
      this._error.set(this.extractError(err));
      return null;
    } finally {
      this._loading.set(false);
    }
  }

  /** يحوّل أي شكل خطأ إلى نصّ قابل للعرض */
  private extractError(err: unknown): string {
    const e = err as HttpErrorResponse;
    const body = e?.error;
    if (body && typeof body === 'object') {
      const b = body as { error?: unknown; detail?: unknown; raw?: unknown; cleaned?: unknown };
      const parts: string[] = [];
      if (typeof b.error === 'string') parts.push(b.error);
      if (typeof b.detail === 'string') parts.push('السبب التقني: ' + b.detail);
      // أعرض مقتطف ما أعاده Claude لنتمكّن من التصحيح
      const snippet = typeof b.cleaned === 'string' ? b.cleaned : typeof b.raw === 'string' ? b.raw : '';
      if (snippet) parts.push('\nما أعاده Claude:\n' + snippet.slice(0, 400) + (snippet.length > 400 ? '…' : ''));
      if (parts.length) return parts.join('\n');
    }
    if (typeof body === 'string' && body.length < 500) return body;
    if (typeof e?.message === 'string' && e.message) return e.message;
    return 'فشل التحليل. تحقّق من الاتصال و حاول مرّة أخرى.';
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
