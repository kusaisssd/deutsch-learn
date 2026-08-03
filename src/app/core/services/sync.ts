import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DictHistoryEntry } from '../models/dictionary.model';

const PASS_KEY = 'deutsch-learn:sync-passphrase';
const LAST_SYNC_KEY = 'deutsch-learn:last-sync';
const AUTO_SYNC_KEY = 'deutsch-learn:auto-sync';

export type SyncStatus = 'idle' | 'pulling' | 'pushing' | 'error' | 'success';

export interface SyncBlob {
  entries: DictHistoryEntry[];
  updatedAt: number;
}

/**
 * SyncService — يزامن سجلّ القاموس المخبّأ سحابياً عبر /api/sync.
 * المصادقة عبر passphrase يختارها المستخدم؛ نحفظها محلياً و نُرسلها في header.
 */
@Injectable({ providedIn: 'root' })
export class SyncService {
  private http = inject(HttpClient);

  private readonly _passphrase = signal<string>(this.load(PASS_KEY) ?? '');
  private readonly _lastSync = signal<number>(Number(this.load(LAST_SYNC_KEY) ?? 0));
  private readonly _auto = signal<boolean>((this.load(AUTO_SYNC_KEY) ?? '1') === '1');
  private readonly _status = signal<SyncStatus>('idle');
  private readonly _error = signal<string | null>(null);

  readonly passphrase = this._passphrase.asReadonly();
  readonly lastSync = this._lastSync.asReadonly();
  readonly autoSync = this._auto.asReadonly();
  readonly status = this._status.asReadonly();
  readonly error = this._error.asReadonly();
  readonly hasPassphrase = () => this._passphrase().length >= 6;

  setPassphrase(p: string): void {
    const trimmed = p.trim();
    this._passphrase.set(trimmed);
    this.save(PASS_KEY, trimmed);
  }
  setAuto(on: boolean): void {
    this._auto.set(on);
    this.save(AUTO_SYNC_KEY, on ? '1' : '0');
  }
  clearPassphrase(): void {
    this._passphrase.set('');
    localStorage.removeItem(PASS_KEY);
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ 'x-sync-key': this._passphrase() });
  }

  /** يسحب آخر blob من السحابة (أو null إن غير موجود) */
  async pull(): Promise<SyncBlob | null> {
    if (!this.hasPassphrase()) return null;
    this._status.set('pulling');
    this._error.set(null);
    try {
      const res = await firstValueFrom(
        this.http.get<SyncBlob | null>('/api/sync', { headers: this.headers() }),
      );
      this._status.set('success');
      this._lastSync.set(Date.now());
      this.save(LAST_SYNC_KEY, String(Date.now()));
      return res ?? null;
    } catch (err) {
      const e = err as HttpErrorResponse;
      this._error.set(e.error?.error ?? e.message ?? 'Pull failed');
      this._status.set('error');
      return null;
    }
  }

  /** يدفع blob كامل للسحابة */
  async push(blob: SyncBlob): Promise<boolean> {
    if (!this.hasPassphrase()) return false;
    this._status.set('pushing');
    this._error.set(null);
    try {
      await firstValueFrom(
        this.http.post('/api/sync', blob, { headers: this.headers() }),
      );
      this._status.set('success');
      this._lastSync.set(Date.now());
      this.save(LAST_SYNC_KEY, String(Date.now()));
      return true;
    } catch (err) {
      const e = err as HttpErrorResponse;
      this._error.set(e.error?.error ?? e.message ?? 'Push failed');
      this._status.set('error');
      return false;
    }
  }

  /**
   * يدمج قائمتين حسب (word+kind): الأحدث حسب ts يفوز، و الحقول
   * الاختيارية (translation, ai, aiDeep) تُحفَظ من الأحدث فالأقدم كـfallback.
   * أمّا asks[] فتُجمع كاتّحاد (union) بلا تكرار حسب ts، حتى لا نفقد
   * أسئلةً طُرحت على جهاز و لم تصل الآخر بعد.
   */
  merge(a: DictHistoryEntry[], b: DictHistoryEntry[]): DictHistoryEntry[] {
    const map = new Map<string, DictHistoryEntry>();
    const key = (e: DictHistoryEntry) => `${e.kind}::${e.word.toLowerCase()}`;
    const consider = (e: DictHistoryEntry) => {
      const k = key(e);
      const prev = map.get(k);
      if (!prev) { map.set(k, { ...e }); return; }
      const newer = e.ts > prev.ts ? e : prev;
      const older = e.ts > prev.ts ? prev : e;
      map.set(k, {
        ...newer,
        translation: newer.translation ?? older.translation,
        ai: newer.ai ?? older.ai,
        aiDeep: newer.aiDeep ?? older.aiDeep,
        asks: this.mergeAsks(newer.asks, older.asks),
      });
    };
    for (const e of a) consider(e);
    for (const e of b) consider(e);
    return Array.from(map.values()).sort((x, y) => y.ts - x.ts);
  }

  /** يجمع قائمتَي أسئلة كاتّحاد بلا تكرار (المفتاح = ts) */
  private mergeAsks(a?: unknown[], b?: unknown[]): unknown[] | undefined {
    const aa = Array.isArray(a) ? a : [];
    const bb = Array.isArray(b) ? b : [];
    if (!aa.length && !bb.length) return undefined;
    const seen = new Set<number>();
    const out: unknown[] = [];
    for (const item of [...aa, ...bb]) {
      const ts = (item as { ts?: number }).ts;
      if (typeof ts === 'number' && !seen.has(ts)) { seen.add(ts); out.push(item); }
    }
    return out.sort((x, y) => ((x as { ts: number }).ts) - ((y as { ts: number }).ts));
  }

  private load(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  private save(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  }
}
