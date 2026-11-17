import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Toaster } from '@lms/ui';
import { SESSION_STORAGE } from '../storage/session-storage';
import { KeptDrafts } from './kept-drafts';
import { SessionExpiry } from './session-expiry';
import { SessionStore } from './session.store';
import { fakeSession, FakeSessionStore, seedProfile } from './session.testing';

describe('KeptDrafts', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SessionStore, useClass: FakeSessionStore },
      ],
    });
  });

  afterEach(() => TestBed.inject(Toaster).dismissAll());

  it('gives a kept draft back once, then forgets it', () => {
    const drafts = TestBed.inject(KeptDrafts);
    drafts.keep('course:000002:6', { title: 'Mới' });

    expect(drafts.take('course:000002:6')?.value).toEqual({ title: 'Mới' });
    expect(drafts.take('course:000002:6')).toBeNull();
  });

  it('keeps nothing when storage is missing, and reads nothing unreadable', () => {
    sessionStorage.setItem('lms.keptDraft:bad', '{not json');
    expect(TestBed.inject(KeptDrafts).take('bad')).toBeNull();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: SESSION_STORAGE, useValue: null }],
    });
    const drafts = TestBed.inject(KeptDrafts);
    drafts.keep('x', 1);
    expect(drafts.take('x')).toBeNull();
  });

  it('an ended session keeps the open pages’ drafts before it leaves them', () => {
    fakeSession().user.set(seedProfile('000002'));
    const drafts = TestBed.inject(KeptDrafts);
    const order: string[] = [];
    TestBed.runInInjectionContext(() =>
      drafts.whileOpen(() => {
        order.push(fakeSession().isSignedIn$() ? 'kept' : 'too late');
      }),
    );
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');

    TestBed.inject(SessionExpiry).end();

    expect(order).toEqual(['kept']);
    expect(navigate).toHaveBeenCalled();
  });
});
