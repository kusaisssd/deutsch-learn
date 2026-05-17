import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { routes } from './app.routes';

/**
 * إعدادات التطبيق - كل الـ Providers على مستوى الجذر.
 *
 * هذا يقابل في ASP.NET:
 *   builder.Services.AddRouting();
 *   builder.Services.AddHttpClient();
 */
export const appConfig: ApplicationConfig = {
  providers: [
    // يلتقط الأخطاء العامة و يعرضها في الـ console
    provideBrowserGlobalErrorListeners(),

    /**
     * تفعيل الـ Router مع ميزة "Component Input Binding".
     *
     * بدون withComponentInputBinding():
     *   كي نقرأ :level من URL، نضطر لاستخدام ActivatedRoute (كلام أطول).
     *
     * مع withComponentInputBinding():
     *   نكتب فقط `level = input.required<string>()` في الـ component.
     *   Angular يربط :level من الـ URL تلقائياً بهذا الـ input!
     */
    provideRouter(routes, withComponentInputBinding()),

    /**
     * تفعيل HttpClient (لطلبات HTTP).
     * بدونه: لا نستطيع استخدام this.http.get(...).
     */
    provideHttpClient(),
  ],
};
