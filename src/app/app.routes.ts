import { Routes } from '@angular/router';

/**
 * تعريف صفحات التطبيق.
 *
 * نستخدم `loadComponent` (lazy loading) بدل `component:` المباشر:
 * - الفائدة: كل صفحة تُحمَّل من السيرفر فقط عند زيارتها أول مرة.
 * - النتيجة: التطبيق يبدأ أسرع (bundle أصغر).
 */
export const routes: Routes = [
  // الصفحة الجذرية: نحوّل تلقائياً إلى /levels
  {
    path: '',
    redirectTo: 'levels',
    pathMatch: 'full',
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

  // أي URL غير معروف → نرجع إلى /levels
  {
    path: '**',
    redirectTo: 'levels',
  },
];
