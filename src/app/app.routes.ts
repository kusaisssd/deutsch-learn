import { Routes } from '@angular/router';

/**
 * تعريف صفحات التطبيق.
 *
 * نستخدم `loadComponent` (lazy loading) بدل `component:` المباشر:
 * - الفائدة: كل صفحة تُحمَّل من السيرفر فقط عند زيارتها أول مرة.
 * - النتيجة: التطبيق يبدأ أسرع (bundle أصغر).
 */
export const routes: Routes = [
  // 🆕 الصفحة الرئيسية: روادمب التعلم + إحصائيات + 3 بطاقات
  {
    path: '',
    loadComponent: () =>
      import('./features/home/home-page/home-page').then(m => m.HomePage),
    title: 'Deutsch Learn — Your German learning journey',
  },

  // صفحة اختيار المستوى: /levels
  {
    path: 'levels',
    loadComponent: () =>
      import('./features/levels/levels-page/levels-page').then(m => m.LevelsPage),
    title: 'Levels - Deutsch Learn',
  },

  // صفحة قائمة الجمل لمستوى معين: /levels/A1/sentences
  // الجزء :level متغير، سنقرأه داخل الـ component
  {
    path: 'levels/:level/sentences',
    loadComponent: () =>
      import('./features/sentences/sentences-page/sentences-page').then(m => m.SentencesPage),
    title: 'Sentences - Deutsch Learn',
  },

  // صفحة التمرين: /practice/5
  {
    path: 'practice/:sentenceId',
    loadComponent: () =>
      import('./features/practice/practice-page/practice-page').then(m => m.PracticePage),
    title: 'Practice - Deutsch Learn',
  },

  // صفحة قارئ النصوص: /reader
  {
    path: 'reader',
    loadComponent: () =>
      import('./features/reader/reader-page/reader-page').then(m => m.ReaderPage),
    title: 'Reader - Deutsch Learn',
  },

  // 🆕 Topics: قائمة المواضيع التعليمية (Pronouns, Tech, Shopping, …)
  {
    path: 'topics',
    loadComponent: () =>
      import('./features/topics/topics-list-page/topics-list-page')
        .then(m => m.TopicsListPage),
    title: 'Topics - Deutsch Learn',
  },

  // 🆕 صفحة موضوع واحد: قائمة جمله مُجمَّعة حسب المستوى + شرح نحوي
  {
    path: 'topics/:topicId',
    loadComponent: () =>
      import('./features/topics/topic-detail-page/topic-detail-page')
        .then(m => m.TopicDetailPage),
    title: 'Topic - Deutsch Learn',
  },

  // 🆕 صفحة تمرين جملة من موضوع. يختلف عن /practice/:id لأنه يعرف الموضوع
  // و يدير التنقّل ضمن جمل نفس الموضوع (لا ضمن المستوى).
  {
    path: 'topics/:topicId/practice/:sentenceId',
    loadComponent: () =>
      import('./features/topics/topic-practice-page/topic-practice-page')
        .then(m => m.TopicPracticePage),
    title: 'Practice — Deutsch Learn',
  },

  // 🆕 Cards Café: قائمة فئات بطاقات الحوار الذاتي (مستوحاة من Talk-Box)
  //
  // 🎯 nested routing: /cafe/:categoryId يُرسم كـ modal فوق CafeListPage
  //    عبر <router-outlet /> داخل قائمة الفئات.
  //    هذا يُبقي الشبكة مرئية خلف الـ modal (lightbox effect).
  {
    path: 'cafe',
    loadComponent: () =>
      import('./features/cafe/cafe-list-page/cafe-list-page')
        .then(m => m.CafeListPage),
    title: 'Cards Café - Deutsch Learn',
    children: [
      {
        path: ':categoryId',
        loadComponent: () =>
          import('./features/cafe/cafe-draw-page/cafe-draw-page')
            .then(m => m.CafeDrawPage),
        title: 'Café — Deutsch Learn',
      },
    ],
  },

  // 🆕 Conversations: قائمة المحادثات (مُجمَّعة حسب السياق)
  {
    path: 'conversations',
    loadComponent: () =>
      import('./features/conversations/conversations-list-page/conversations-list-page')
        .then(m => m.ConversationsListPage),
    title: 'Conversations - Deutsch Learn',
  },

  // 🆕 محادثة واحدة (شغّال متعدد الأدوار). :id متغير string.
  {
    path: 'conversations/:id',
    loadComponent: () =>
      import('./features/conversations/conversation-player-page/conversation-player-page')
        .then(m => m.ConversationPlayerPage),
    title: 'Conversation - Deutsch Learn',
  },

  // أي URL غير معروف → نرجع للصفحة الرئيسية (أكثر طبيعية من /levels الآن)
  {
    path: '**',
    redirectTo: '',
  },
];
