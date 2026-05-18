import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Sentence } from '../models/sentence.model';
import { LevelCode } from '../models/level.model';

/**
 * الشكل الذي يصل من ملف topic-sentences.json:
 *   {
 *     "pronouns": [Sentence, Sentence, ...],
 *     "tech":     [Sentence, ...],
 *     ...
 *   }
 *
 * 🎓 Record<K, V> هو نوع TypeScript لـ "object يُستخدم كقاموس":
 *   مكافئ C#: Dictionary<string, Sentence[]>
 */
type TopicSentencesMap = Record<string, Sentence[]>;

/**
 * TopicSentencesService
 *
 * مسؤول عن:
 *   - تحميل ملف topic-sentences.json (HTTP، مرة واحدة)
 *   - توفير جمل موضوع معيّن (مرتّبة A1→B2)
 *   - البحث عن جملة فردية عبر id
 *
 * 🎯 لماذا signals + computed بدل Observables BehaviorSubject؟
 *   - الـ template يقرأها بـ `service.x()` مباشرة، بدون async pipe
 *   - re-render تلقائي عند التغيير
 *   - فحص Change Detection أسرع (zone-less compatible)
 *
 * الربط بـ ASP.NET:
 *   public interface ITopicSentencesRepository {
 *     Task LoadAsync();
 *     IReadOnlyList<Sentence> GetByTopic(string topicId);
 *     Sentence? GetById(int id);
 *   }
 */
@Injectable({ providedIn: 'root' })
export class TopicSentencesService {
  private http = inject(HttpClient);

  /** الـ map الخام كما وصل من الـ JSON (private) */
  private readonly _data = signal<TopicSentencesMap>({});
  private readonly _loaded = signal(false);

  /** للقراءة فقط من الخارج */
  readonly loaded = this._loaded.asReadonly();

  /**
   * يُرجع كل الجمل لموضوع معيّن — كـ computed تفاعلي.
   *
   * 🎓 لماذا الجمل تأتي مرتّبة A1→B2 تلقائياً؟
   *   لأننا رتّبناها كذلك في ملف JSON المصدر.
   *   لو احتجنا فرض الترتيب برمجياً (في حالة بيانات غير مرتّبة):
   *
   *     return arr.slice().sort((a, b) =>
   *       LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]
   *     );
   */
  sentencesByTopic(topicId: string) {
    return computed(() => this._data()[topicId] ?? []);
  }

  /**
   * عدّاد الجمل لموضوع (مفيد في بطاقات قائمة المواضيع).
   */
  countByTopic(topicId: string) {
    return computed(() => (this._data()[topicId] ?? []).length);
  }

  /**
   * تجميع جمل موضوع حسب المستوى — مفيد لعرضها بأقسام (A1, A2, B1, B2).
   *
   * يُرجع: { A1: [...], A2: [...], B1: [...], B2: [...] }
   * (المستويات الفارغة موجودة بـ array فارغ، يسهّل العرض)
   */
  sentencesByTopicGroupedByLevel(topicId: string) {
    return computed(() => {
      const sentences = this._data()[topicId] ?? [];
      const result: Record<LevelCode, Sentence[]> = {
        A1: [],
        A2: [],
        B1: [],
        B2: [],
      };
      for (const s of sentences) {
        result[s.level].push(s);
      }
      return result;
    });
  }

  /**
   * البحث عن جملة محددة عبر id (يبحث في كل المواضيع).
   *
   * نمط: نستخدم flat() لدمج كل الـ arrays ثم find().
   * 🎓 Object.values(map) يُرجع array من القيم (الـ arrays في حالتنا).
   *
   * computed: يُعاد حسابه فقط لو تغيّر _data — أداء ممتاز.
   */
  sentenceById(id: number) {
    return computed(() => {
      const all = Object.values(this._data()).flat();
      return all.find(s => s.id === id);
    });
  }

  /**
   * إيجاد الموضوع الذي تنتمي إليه جملة معيّنة.
   * يُستخدم في صفحة Practice كي نعرف زر "Back to topic" أين يذهب.
   */
  topicIdForSentence(sentenceId: number) {
    return computed(() => {
      const map = this._data();
      for (const [topicId, sentences] of Object.entries(map)) {
        if (sentences.some(s => s.id === sentenceId)) return topicId;
      }
      return undefined;
    });
  }

  constructor() {
    this.http.get<TopicSentencesMap>('/data/topic-sentences.json').subscribe({
      next: (data) => {
        this._data.set(data);
        this._loaded.set(true);
      },
      error: (err) => {
        console.error('Failed to load topic sentences:', err);
        this._loaded.set(true);
      },
    });
  }
}
