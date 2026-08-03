import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SyncService } from '../../../core/services/sync';
import { DictionaryService } from '../../../core/services/dictionary';

@Component({
  selector: 'app-dictionary-settings-page',
  imports: [RouterLink],
  templateUrl: './dictionary-settings-page.html',
})
export class DictionarySettingsPage {
  readonly sync = inject(SyncService);
  private dict = inject(DictionaryService);

  readonly input = signal(this.sync.passphrase());
  readonly syncing = signal(false);

  // ─── استيراد من passphrase آخر (لدمج مفتاحين قديمين) ───
  readonly otherPass = signal('');
  readonly importing = signal(false);
  readonly importMsg = signal<string | null>(null);
  readonly importError = signal<string | null>(null);

  updateInput(v: string) { this.input.set(v); }
  updateOther(v: string) { this.otherPass.set(v); }

  async importOther() {
    const other = this.otherPass().trim();
    if (other.length < 6) {
      this.importError.set('اكتب الـ passphrase القديم كاملاً (6+ أحرف).');
      return;
    }
    if (other === this.sync.passphrase()) {
      this.importError.set('هذا نفس الـ passphrase الحالي — لا حاجة للاستيراد.');
      return;
    }
    this.importing.set(true);
    this.importMsg.set(null);
    this.importError.set(null);
    try {
      const added = await this.dict.importFromOtherPassphrase(other);
      if (added > 0) {
        this.importMsg.set(`✅ تمّ استيراد ${added} كلمة/عبارة جديدة من الـ passphrase الآخر و ستُدفع للسحابة الحاليّة تلقائياً.`);
      } else {
        this.importMsg.set('لم يوجد شيء جديد لاستيراده (إمّا الـ passphrase فارغ أو الكلمات موجودة أصلاً).');
      }
      this.otherPass.set('');
    } catch (e) {
      this.importError.set('فشل الاستيراد — تحقّق من الـ passphrase و الاتصال.');
    } finally {
      this.importing.set(false);
    }
  }

  save() {
    this.sync.setPassphrase(this.input().trim());
  }

  clear() {
    if (!confirm('حذف الـ passphrase من هذا الجهاز؟ (لا يمسح البيانات من السحابة)')) return;
    this.sync.clearPassphrase();
    this.input.set('');
  }

  async syncNow() {
    this.syncing.set(true);
    try {
      await this.dict.syncNow();
    } finally {
      this.syncing.set(false);
    }
  }

  toggleAuto() {
    this.sync.setAuto(!this.sync.autoSync());
  }

  /** يقترح passphrase عشوائي قوي */
  suggestPassphrase(): string {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let s = '';
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) s += chars[Math.floor(Math.random() * chars.length)];
      if (i < 3) s += '-';
    }
    return s;
  }
  useGenerated() {
    this.input.set(this.suggestPassphrase());
  }

  formatDate(ts: number): string {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('de-DE');
  }
}
