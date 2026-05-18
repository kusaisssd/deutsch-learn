import { computed, Injectable, signal } from '@angular/core';
import { Topic } from '../models/topic.model';

/**
 * خدمة المواضيع (Topics).
 *
 * المسؤوليات:
 * - تخزين قائمة المواضيع المتاحة.
 * - توفير وصول قراءة فقط من الخارج.
 * - توفير دوال مساعدة للبحث عن موضوع بالـ id.
 *
 * 🎓 لماذا constant داخل Service بدل JSON file؟
 *   - المواضيع قليلة (5-10) و لا تتغيّر بسرعة → لا نحتاج HTTP/async
 *   - متاحة فوراً للـ template (sync) → لا spinner و لا effect
 *   - لو احتجنا لاحقاً جلبها من API، نُغيّر داخل Service فقط
 *
 * الربط بـ ASP.NET:
 *   AddSingleton<ITopicsService, TopicsService>()
 *   GetAll() / GetById(id) — تماماً مثل ما هنا.
 */
@Injectable({ providedIn: 'root' })
export class TopicsService {
  /**
   * قائمة المواضيع كـ signal.
   * private + readonly: لا تعديل من الخارج.
   */
  private readonly _topics = signal<Topic[]>([
    {
      id: 'pronouns',
      title: 'Pronouns',
      emoji: '🧑‍🤝‍🧑',
      description:
        'Master ich/du/er/sie/es and their cases: Nominativ, Akkusativ, Dativ.',
      color: 'emerald',
      grammarOverview: `Personal pronouns change form depending on their role:

• NOMINATIV (subject):  ich, du, er, sie, es, wir, ihr, sie/Sie
• AKKUSATIV (direct object): mich, dich, ihn, sie, es, uns, euch, sie/Sie
• DATIV (indirect object): mir, dir, ihm, ihr, ihm, uns, euch, ihnen/Ihnen

Possessive forms: mein, dein, sein, ihr, sein, unser, euer, ihr/Ihr
(these also change ending based on the noun's gender and case!)`,
    },
    {
      id: 'tech',
      title: 'Technology',
      emoji: '💻',
      description:
        'Daily tech vocabulary: computers, internet, phones, software, and work tools.',
      color: 'sky',
      grammarOverview: `Tech vocabulary often borrows from English but uses German grammar:

• der Computer, das Internet, das Smartphone, die Software, die App
• Verbs: öffnen (to open), schließen (to close), herunterladen (to download),
  installieren, speichern (to save), klicken, tippen

Many compound nouns appear:
  die Datenbank = Daten + Bank (database)
  der Bildschirm = Bild + Schirm (screen)`,
    },
    {
      id: 'shopping',
      title: 'Shopping',
      emoji: '🛒',
      description:
        'Buying things, asking prices, sizes and colors — both online and in stores.',
      color: 'amber',
      grammarOverview: `Shopping uses lots of Akkusativ (direct object):

• Ich kaufe DEN Apfel / DIE Birne / DAS Brot / DIE Äpfel
• Ich brauche EINEN Stift / EINE Tasche / EIN Buch

Asking prices: Was kostet …? / Wie viel kostet …?
Sizes & colors agree with the noun's gender:
  ein rotES Hemd, eine rotE Hose, ein rotER Schal`,
    },
    {
      id: 'time-numbers',
      title: 'Time & Numbers',
      emoji: '⏰',
      description:
        'Telling time, dates, numbers, days of the week, and ordering events.',
      color: 'violet',
      grammarOverview: `Numbers in German read "ones first, then tens":
  21 = einundzwanzig (one-and-twenty)
  45 = fünfundvierzig (five-and-forty)

Telling time (informal):
  Es ist halb drei = 2:30 (half before three!)
  Es ist Viertel vor sechs = 5:45

Days: Montag, Dienstag, Mittwoch, Donnerstag, Freitag, Samstag, Sonntag
Months: Januar, Februar, März, April, …`,
    },
    {
      id: 'health-body',
      title: 'Health & Body',
      emoji: '🏥',
      description:
        'Body parts, symptoms, doctor visits, and describing how you feel.',
      color: 'rose',
      grammarOverview: `Body parts often use DATIV when expressing pain:
  Mir tut der Kopf weh = My head hurts (lit: "to me hurts the head")
  Ihr tut der Bauch weh = Her stomach hurts

Common verbs:
  sich fühlen (to feel) — REFLEXIVE: Ich fühle mich krank
  weh tun (to hurt)
  haben + Schmerzen: Ich habe Kopfschmerzen / Bauchschmerzen / Halsschmerzen`,
    },
  ]);

  /** قراءة فقط من الخارج */
  readonly topics = this._topics.asReadonly();

  /**
   * يُرجع موضوعاً عبر id كـ computed.
   *
   * 🎓 لماذا computed و ليس دالة بسيطة؟
   *   - computed يعمل cache: إذا لم تتغيّر القائمة، نفس النتيجة تُرجع
   *   - reactive: لو غيّرنا المواضيع لاحقاً (مثلاً API)، الـ template يُحدّث تلقائياً
   *
   * الاستخدام:
   *   readonly topic = this.topicsService.topicById(this.id());
   *   ← يُستخدم في template مثل: topic()?.title
   */
  topicById(id: string) {
    return computed(() => this._topics().find(t => t.id === id));
  }
}
