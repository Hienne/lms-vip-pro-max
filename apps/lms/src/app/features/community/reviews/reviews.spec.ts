import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CommunityReviews } from './reviews';
import { ReviewsStore } from './data-access/reviews.store';

describe('CommunityReviews', () => {
  const loading = signal(false);
  beforeEach(() => {
    loading.set(false);
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.overrideComponent(CommunityReviews, {
      set: {
        providers: [
          {
            provide: ReviewsStore,
            useValue: {
              q$: signal(''),
              status$: signal(''),
              page$: signal(1),
              items$: signal([]),
              total$: signal(0),
              isLoading$: loading,
              error$: signal(undefined),
            },
          },
        ],
      },
    });
  });

  it('renders the create action in the shared page header', async () => {
    const fixture = TestBed.createComponent(CommunityReviews);
    fixture.detectChanges();
    await fixture.whenStable();
    const header = (fixture.nativeElement as HTMLElement).querySelector(
      '.page-header__actions',
    );
    expect(header?.textContent).toContain('Tạo đề nghị review');
    expect(header?.querySelector('a')?.getAttribute('href')).toBe(
      '/community/reviews/new',
    );
  });

  it('shows loading before an empty result is known', async () => {
    loading.set(true);
    const fixture = TestBed.createComponent(CommunityReviews);
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[role=status]')?.textContent).toContain(
      'Đang tải đề nghị review',
    );
    expect(element.textContent).not.toContain('Chưa có đề nghị phù hợp');
  });
});
