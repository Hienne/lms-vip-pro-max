import { TestBed } from '@angular/core/testing';
import { SESSION_STORAGE } from '../../../../core/storage/session-storage';
import { StudySessionStorage } from './study-session.storage';

const ID = '5b0c1c3e-5d57-4a3f-9a3f-0c6f6f0a1b01';
const KEY = 'lms.study-session.v1.000004.11';

describe('StudySessionStorage', () => {
  beforeEach(() => sessionStorage.clear());

  it('reads back the ids it wrote, per user and enrolment, under a versioned key', () => {
    const storage = TestBed.inject(StudySessionStorage);
    storage.write('000004', 11, { sessionId: ID, sessionFence: 3 });
    expect(sessionStorage.getItem(KEY)).not.toBeNull();
    expect(storage.read('000004', 11)).toEqual({
      sessionId: ID,
      sessionFence: 3,
    });
    expect(storage.read('000004', 12)).toBeNull();
    expect(storage.read('000005', 11)).toBeNull();
  });

  it.each([
    ['not json', '{oops'],
    ['an older shape', JSON.stringify({ id: ID })],
    [
      'a session id that is no uuid',
      JSON.stringify({ sessionId: 'x', sessionFence: 1 }),
    ],
    [
      'a fence that is not a number',
      JSON.stringify({ sessionId: ID, sessionFence: 'a' }),
    ],
  ])('discards %s and reads nothing', (_, raw) => {
    sessionStorage.setItem(KEY, raw);
    expect(TestBed.inject(StudySessionStorage).read('000004', 11)).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('clears one enrolment', () => {
    const storage = TestBed.inject(StudySessionStorage);
    storage.write('000004', 11, { sessionId: ID, sessionFence: 3 });
    storage.write('000004', 12, { sessionId: ID, sessionFence: 4 });
    storage.clear('000004', 11);
    expect(storage.read('000004', 11)).toBeNull();
    expect(storage.read('000004', 12)).not.toBeNull();
  });

  it('clears every session of the tab on sign-out and leaves other keys alone', () => {
    const storage = TestBed.inject(StudySessionStorage);
    storage.write('000004', 11, { sessionId: ID, sessionFence: 3 });
    storage.write('000007', 12, { sessionId: ID, sessionFence: 4 });
    sessionStorage.setItem('lms.agent-chat.v1.000004', '{}');
    storage.clearAll();
    expect(storage.read('000004', 11)).toBeNull();
    expect(storage.read('000007', 12)).toBeNull();
    expect(sessionStorage.getItem('lms.agent-chat.v1.000004')).toBe('{}');
  });

  it('keeps the ids in memory when the browser blocks storage', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: SESSION_STORAGE, useValue: null }],
    });
    const storage = TestBed.inject(StudySessionStorage);
    storage.write('000004', 11, { sessionId: ID, sessionFence: 3 });
    expect(storage.read('000004', 11)).toEqual({
      sessionId: ID,
      sessionFence: 3,
    });
    storage.clearAll();
    expect(storage.read('000004', 11)).toBeNull();
  });

  it('keeps the ids in memory when storage throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
      key: () => {
        throw new Error('blocked');
      },
      length: 1,
    };
    TestBed.configureTestingModule({
      providers: [{ provide: SESSION_STORAGE, useValue: broken }],
    });
    const storage = TestBed.inject(StudySessionStorage);
    storage.write('000004', 11, { sessionId: ID, sessionFence: 3 });
    expect(storage.read('000004', 11)).toEqual({
      sessionId: ID,
      sessionFence: 3,
    });
    storage.clearAll();
    expect(storage.read('000004', 11)).toBeNull();
  });
});
