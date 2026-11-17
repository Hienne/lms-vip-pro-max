import { TestBed } from '@angular/core/testing';
import { SESSION_STORAGE } from '../storage/session-storage';
import { AgentChatStorage } from './agent-chat.storage';

const KEY = 'lms.agent-chat.v2.000004';
const LEGACY_KEY = 'lms.agent-chat.v1.000004';

describe('AgentChatStorage', () => {
  it('reads back what it wrote, per user, under a versioned key', () => {
    const storage = TestBed.inject(AgentChatStorage);
    storage.write('000004', { open: true, conversationId: 7 });
    expect(sessionStorage.getItem(KEY)).not.toBeNull();
    expect(storage.read('000004')).toEqual({ open: true, conversationId: 7 });
    expect(storage.read('000005')).toEqual({ open: false });
  });

  it('stores nothing but the panel state and the conversation id', () => {
    const storage = TestBed.inject(AgentChatStorage);
    storage.write('000004', {
      open: true,
      docked: true,
      conversationId: 7,
      // A caller that still passes turns must not leak them into the tab.
      ...({ turns: [{ id: 1, question: 'Bí mật' }] } as object),
    });
    const raw = sessionStorage.getItem(KEY) ?? '';
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual([
      'conversationId',
      'docked',
      'open',
    ]);
    expect(raw).not.toContain('Bí mật');
  });

  it('stores docked only when it is on, and reads an entry without it as floating', () => {
    const storage = TestBed.inject(AgentChatStorage);
    storage.write('000004', { open: true, docked: false });
    expect(sessionStorage.getItem(KEY)).not.toContain('docked');
    expect(storage.read('000004')).toEqual({ open: true });
    storage.write('000004', { open: true, docked: true });
    expect(storage.read('000004')).toEqual({ open: true, docked: true });
  });

  it.each([
    'not json',
    'null',
    '[]',
    '{}',
    '{"open":"yes"}',
    '{"open":true,"conversationId":0}',
  ])('discards the entry %s and starts empty', (entry) => {
    sessionStorage.setItem(KEY, entry);
    expect(TestBed.inject(AgentChatStorage).read('000004')).toEqual({
      open: false,
    });
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('ignores and removes an entry of the first shape, the one that kept turns in the tab', () => {
    sessionStorage.setItem(
      LEGACY_KEY,
      JSON.stringify({
        open: true,
        turns: [{ id: 1, question: 'Câu hỏi cũ', reply: {} }],
      }),
    );
    expect(TestBed.inject(AgentChatStorage).read('000004')).toEqual({
      open: false,
    });
    expect(sessionStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  it('removes the entry on clear', () => {
    const storage = TestBed.inject(AgentChatStorage);
    storage.write('000004', { open: true, conversationId: 7 });
    storage.clear('000004');
    expect(sessionStorage.getItem(KEY)).toBeNull();
    expect(storage.read('000004')).toEqual({ open: false });
  });

  it('removes every other user’s entry, and any entry of the first shape, and leaves this user’s and other keys', () => {
    const storage = TestBed.inject(AgentChatStorage);
    storage.write('000004', { open: true });
    storage.write('000005', { open: true });
    sessionStorage.setItem('lms.agent-chat.v1.000006', '{}');
    sessionStorage.setItem('lms.other', 'kept');

    storage.clearOthers('000004');

    expect(sessionStorage.getItem(KEY)).not.toBeNull();
    expect(sessionStorage.getItem('lms.agent-chat.v2.000005')).toBeNull();
    expect(sessionStorage.getItem('lms.agent-chat.v1.000006')).toBeNull();
    expect(sessionStorage.getItem('lms.other')).toBe('kept');
    sessionStorage.removeItem('lms.other');
  });

  it('works in memory when storage is blocked or throws', () => {
    for (const blocked of [
      null,
      {
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
        get length(): number {
          throw new Error('blocked');
        },
      },
    ]) {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: SESSION_STORAGE, useValue: blocked }],
      });
      const storage = TestBed.inject(AgentChatStorage);
      storage.write('000004', { open: true, conversationId: 3 });
      expect(storage.read('000004')).toEqual({ open: true, conversationId: 3 });
      storage.clear('000004');
      expect(storage.read('000004')).toEqual({ open: false });
      storage.write('000005', { open: true });
      storage.clearOthers('000004');
      expect(storage.read('000005')).toEqual({ open: false });
    }
  });
});
