import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

/**
 * اختبارات المكوّن الجذري App.
 *
 * 🎯 لماذا provideRouter([])؟
 *   App يستخدم RouterLink (في التابات) و RouterOutlet (في الـ main).
 *   هذان يحتاجان ActivatedRoute و Router من نظام الـ routing.
 *   في الاختبار نوفّر router فارغ (مسارات []) كبديل خفيف (test double).
 *
 *   بدونه: NG0201 "No provider found for ActivatedRoute".
 *   هذا خطأ شائع جداً عند اختبار مكوّن يحوي عناصر routing.
 */
describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the brand title in the header', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Deutsch Learn');
  });

  it('should render the main navigation tabs', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const nav = compiled.querySelector('nav');
    expect(nav).toBeTruthy();
    // الـ nav يحوي 5 تبويبات: Practice, Topics, Café Hope, Conversations, Reader
    const tabs = nav?.querySelectorAll('a');
    expect(tabs?.length).toBe(5);
  });
});
