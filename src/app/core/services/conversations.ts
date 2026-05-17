import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Conversation } from '../models/conversation.model';

/**
 * مجموعة محادثات تشترك في سياق واحد (مثلاً كل محادثات الطبيب).
 * نستخدمها في صفحة القائمة لعرض المحادثات مُجمَّعة بصرياً.
 */
export interface ConversationGroup {
  context: string;            // 'doctor'
  contextEmoji: string;       // '🏥'
  contextTitle: string;       // 'At the Doctor'
  conversations: Conversation[];
}

/**
 * ConversationsService
 *
 * نمط مألوف:
 *   - HttpClient لتحميل JSON.
 *   - signal خاص (private) للبيانات.
 *   - signal للقراءة فقط للخارج.
 *   - computed لتحويلات مفيدة (grouped, byId).
 *
 * 🎯 الجديد هنا: استخدام computed لتحويل المصفوفة لـ "مجموعات"
 *   بدل أن يفعل كل component هذا التجميع بنفسه.
 */
@Injectable({ providedIn: 'root' })
export class ConversationsService {
  private http = inject(HttpClient);

  private readonly _conversations = signal<Conversation[]>([]);
  private readonly _loaded = signal(false);

  readonly conversations = this._conversations.asReadonly();
  readonly loaded = this._loaded.asReadonly();

  /**
   * المحادثات مُجمَّعة حسب السياق.
   *
   * 🎯 computed يُعاد حسابه تلقائياً لو تغيّرت _conversations.
   * نمط شائع: تحويل البيانات الخام إلى شكل مُهيَّأ للعرض.
   *
   * مثال للنتيجة:
   *   [
   *     { context: 'doctor',  conversations: [conv1, conv2] },
   *     { context: 'shopping', conversations: [conv3] },
   *     ...
   *   ]
   */
  readonly grouped = computed<ConversationGroup[]>(() => {
    const all = this._conversations();
    // نستخدم Map لتجميع نوعي (لا نُكرّر السياق)
    const map = new Map<string, ConversationGroup>();

    for (const conv of all) {
      if (!map.has(conv.context)) {
        map.set(conv.context, {
          context: conv.context,
          contextEmoji: conv.contextEmoji,
          contextTitle: conv.contextTitle,
          conversations: [],
        });
      }
      map.get(conv.context)!.conversations.push(conv);
    }

    return Array.from(map.values());
  });

  /**
   * إرجاع محادثة واحدة عبر الـ id.
   * يُرجع computed كي تكون "تفاعلية" مع تغيّرات البيانات.
   *
   * مقابل في C#:
   *   public Conversation? GetById(string id) => _all.FirstOrDefault(c => c.Id == id);
   */
  conversationById(id: string) {
    return computed(() =>
      this._conversations().find(c => c.id === id)
    );
  }

  constructor() {
    this.http.get<Conversation[]>('/data/conversations.json').subscribe({
      next: (data) => {
        this._conversations.set(data);
        this._loaded.set(true);
      },
      error: (err) => {
        console.error('Failed to load conversations:', err);
        this._loaded.set(true);
      },
    });
  }
}
