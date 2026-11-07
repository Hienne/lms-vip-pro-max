import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { CommunityTabs } from './community-tabs';

@Component({ template: '' })
class Empty {}

describe('CommunityTabs', () => {
  it('links the four community destinations and marks the current one', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'community/questions', component: Empty },
          { path: 'community/articles', component: Empty },
          { path: 'community/reviews', component: Empty },
          { path: 'community/me', component: Empty },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create('/community/articles');
    const fixture = TestBed.createComponent(CommunityTabs);
    fixture.detectChanges();
    await harness.fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const links = Array.from(el.querySelectorAll<HTMLAnchorElement>('a'));
    expect(links.map((a) => a.textContent?.trim())).toEqual([
      'Hỏi đáp',
      'Bài viết',
      'Review kiến trúc',
      'Của tôi',
    ]);
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/community/questions',
      '/community/articles',
      '/community/reviews',
      '/community/me',
    ]);
    expect(links.map((a) => a.getAttribute('aria-current'))).toEqual([
      null,
      'page',
      null,
      null,
    ]);
    expect(el.querySelector('nav')?.getAttribute('aria-label')).toBe(
      'Cộng đồng',
    );
    expect(TestBed.inject(Router).url).toBe('/community/articles');
  });
});
