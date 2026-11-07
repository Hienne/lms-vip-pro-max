import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { ContentCard } from '@lms/contracts';
import { ContentRow } from './content-row';

const card = (patch: Partial<ContentCard> = {}): ContentCard => ({
  contentId: 101,
  kind: 'question',
  title: 'Oracle UCP báo timeout',
  summary: 'Cần tìm nguyên nhân.',
  authorUserId: '000004',
  lifecycleStatus: 'active',
  publishedAt: '2026-10-20T08:00:00Z',
  lastActivityAt: '2026-10-21T08:00:00Z',
  contentVersion: 1,
  author: { userId: '000004', displayName: 'Học viên Demo' },
  tags: [
    { tagId: 1, slug: 'oracle', name: 'Oracle', status: 'active' },
    { tagId: 2, slug: 'spring-boot', name: 'Spring Boot', status: 'active' },
  ],
  score: 3,
  myVote: 0,
  resolutionStatus: 'answered',
  answerCount: 2,
  ...patch,
});

function render(value: ContentCard): HTMLElement {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(ContentRow);
  fixture.componentRef.setInput('card', value);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ContentRow', () => {
  it('links the title to the content and lists the tags as text', () => {
    const el = render(card());
    const title = el.querySelector<HTMLAnchorElement>('.content-row__title')!;
    expect(title.getAttribute('href')).toBe('/community/contents/101');
    expect(el.querySelector('.content-row__meta')?.textContent).toContain(
      'Oracle, Spring Boot',
    );
    expect(el.querySelector('.content-row__meta')?.textContent).toContain(
      'Học viên Demo',
    );
  });

  it('shows the score and the answer count of a question', () => {
    const el = render(card());
    const stats = el.querySelector('.content-row__stats')!;
    expect(stats.textContent).toContain('3');
    expect(stats.textContent).toContain('2');
    expect(
      el.querySelector('app-content-thumbnail img')?.getAttribute('src'),
    ).toContain('/images/community-defaults.png');
  });

  it('shows the server score for an article', () => {
    const el = render(card({ kind: 'article', resolutionStatus: null }));
    expect(el.querySelector('.content-row__stats')?.textContent).toContain('3');
    expect(
      el.querySelector('app-content-thumbnail img')?.getAttribute('src'),
    ).toContain('/images/community-defaults.png');
  });

  it('shows one resolution badge on an active question', () => {
    const el = render(card({ resolutionStatus: 'solved' }));
    const badges = el.querySelectorAll('.badge');
    expect(badges.length).toBe(1);
    expect(badges[0].textContent).toContain('Đã giải quyết');
  });

  it('shows Bản nháp for an unpublished card and Đã đóng for a closed one', () => {
    expect(
      render(card({ publishedAt: null })).querySelector('.badge')?.textContent,
    ).toContain('Bản nháp');
    TestBed.resetTestingModule();
    expect(
      render(card({ lifecycleStatus: 'closed' })).querySelector('.badge')
        ?.textContent,
    ).toContain('Đã đóng');
  });

  it('says when the author has an unpublished draft', () => {
    expect(render(card({ hasDraft: true })).textContent).toContain(
      'Có bản nháp chưa đăng',
    );
  });
});
