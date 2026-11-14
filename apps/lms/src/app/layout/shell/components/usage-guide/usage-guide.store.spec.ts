import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { SessionStore } from '../../../../core/session/session.store';
import {
  FakeSessionStore,
  fakeSession,
  seedProfile,
} from '../../../../core/session/session.testing';
import { UsageGuideStore } from './usage-guide.store';

describe('UsageGuideStore', () => {
  const router = {
    url: '/learn',
    navigateByUrl: vi.fn(async (_: string) => true),
  };
  beforeEach(() => {
    localStorage.clear();
    router.url = '/learn';
    router.navigateByUrl.mockReset().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        UsageGuideStore,
        { provide: SessionStore, useClass: FakeSessionStore },
        { provide: Router, useValue: router },
      ],
    });
  });
  afterEach(() => localStorage.clear());
  function setup(userId = '000004') {
    const profile = seedProfile(userId);
    fakeSession().user.set(profile);
    const store = TestBed.inject(UsageGuideStore);
    store.offer(profile);
    return store;
  }

  it('offers once per account, remembers skipping and lets the user reopen it', () => {
    const store = setup();
    expect(store.stage$()).toBe('welcome');
    store.skip();
    store.offer(fakeSession().user$());
    expect(store.stage$()).toBe('closed');
    store.offer(null);
    store.offer(fakeSession().user$());
    expect(store.stage$()).toBe('closed');
    store.open('learner');
    expect(store.stage$()).toBe('welcome');
    store.skip();
    fakeSession().user.set(seedProfile('000007'));
    store.offer(fakeSession().user$());
    expect(store.stage$()).toBe('welcome');
  });

  it('never offers steps or audiences outside the granted menus', () => {
    const profile = {
      ...seedProfile('000004'),
      menus: ['COURSE_LEARNING' as const],
    };
    fakeSession().user.set(profile);
    const store = TestBed.inject(UsageGuideStore);
    store.offer(profile);
    expect(store.audiences$()).toEqual(['learner']);
    expect(
      store.steps$().every((step) => step.permission === 'COURSE_LEARNING'),
    ).toBe(true);
    store.chooseAudience('instructor');
    expect(store.audience$()).toBe('learner');
  });

  it('defaults replay to the instructor guide after signing back into an instructor account', () => {
    const store = setup('000005');
    expect(store.audience$()).toBe('instructor');
    store.skip();
    store.offer(null);
    store.chooseAudience('learner');
    store.offer(fakeSession().user$());
    expect(store.stage$()).toBe('closed');
    store.open();
    expect(store.audience$()).toBe('instructor');
  });

  it('keeps the current step when an unsaved-changes guard cancels navigation', async () => {
    const store = setup();
    await store.next();
    expect(store.stage$()).toBe('tour');
    await store.next();
    await store.next();
    router.navigateByUrl.mockResolvedValueOnce(false);
    await store.next();
    expect(store.index$()).toBe(2);
    expect(store.error$()).toContain('lưu nháp');
    expect(store.busy$()).toBe(false);
    expect(store.shown$()).toBe(true);
  });

  it.each(['000001', '000002', '000003'])(
    'opens the administrator guide first for admin account %s',
    (userId) => {
      const store = setup(userId);
      expect(store.audience$()).toBe('admin');
      expect(store.stage$()).toBe('welcome');
      expect(store.steps$().length).toBeGreaterThan(0);
      expect(
        store
          .steps$()
          .every((step) => fakeSession().menus$().includes(step.permission)),
      ).toBe(true);
    },
  );

  it('offers an admin guide with only granted administration screens, even without course management', async () => {
    const profile = {
      ...seedProfile('000002'),
      menus: ['USER_MANAGEMENT' as const],
    };
    fakeSession().user.set(profile);
    const store = TestBed.inject(UsageGuideStore);
    store.offer(profile);
    expect(store.audiences$()).toEqual(['admin']);
    expect(store.steps$().map((step) => step.path)).toEqual(['/admin/users']);
    await store.next();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin/users');
    await store.next();
    expect(store.stage$()).toBe('closed');
    expect(localStorage.getItem('lms.usage-guide.v1.000002.admin')).toBe(
      'complete',
    );
  });

  it('keeps administrator and instructor dismissal preferences separate', () => {
    const store = setup('000002');
    store.skip();
    store.open('instructor');
    expect(store.stage$()).toBe('welcome');
    expect(localStorage.getItem('lms.usage-guide.v1.000002.admin')).toBe(
      'skipped',
    );
    expect(
      localStorage.getItem('lms.usage-guide.v1.000002.instructor'),
    ).toBeNull();
  });

  it('finishes all allowed steps, persists completion and supports going back', async () => {
    const store = setup();
    await store.next();
    await store.next();
    await store.back();
    expect(store.index$()).toBe(0);
    for (let i = 0; i < store.total$(); i++) await store.next();
    expect(store.stage$()).toBe('closed');
    expect(localStorage.getItem('lms.usage-guide.v1.000004.learner')).toBe(
      'complete',
    );
  });

  it('does not reopen the tour after logout during navigation', async () => {
    const store = setup();
    router.url = '/catalog';
    let resolve!: (value: boolean) => void;
    router.navigateByUrl.mockImplementationOnce(
      () =>
        new Promise<boolean>((done) => {
          resolve = done;
        }),
    );
    const pending = store.next();
    await vi.waitFor(() => expect(resolve).toBeDefined());
    fakeSession().user.set(null);
    store.offer(null);
    resolve(true);
    await pending;
    expect(store.stage$()).toBe('closed');
    expect(store.busy$()).toBe(false);
  });
});
