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

  updateInput(v: string) { this.input.set(v); }

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
