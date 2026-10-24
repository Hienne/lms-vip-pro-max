import { TestBed } from '@angular/core/testing';
import { SESSION_STORAGE } from '../storage/session-storage';
import type { AgentTurn } from './agent-chat.model';
import { AgentChatStorage } from './agent-chat.storage';

const KEY = 'lms.agent-chat.v1.000004';

const turn = (
  id: number,
  patch: Partial<AgentTurn['reply']> = {},
): AgentTurn => ({
  id,
  question: `Câu hỏi ${id}`,
  reply: {
    status: 'done',
    toolName: null,
    text: `Trả lời ${id}`,
    citations: [],
    navigatedTo: null,
    action: null,
    error: null,
    ...patch,
  },
});

const card = (status: 'pending' | 'confirming' | 'confirmed') => ({
  pending: {
    id: 'a1',
    tool: 'update_profile' as const,
    title: 'Cập nhật hồ sơ cá nhân',
    changes: [
      {
        field: 'positionName' as const,
        label: 'Chức danh',
        from: null,
        to: 'Chuyên viên',
      },
    ],
    expiresAt: '2026-10-24T09:10:00Z',
  },
  status,
  message: null,
});

describe('AgentChatStorage', () => {
  it('reads back what it wrote, per user, under a versioned key', () => {
    const storage = TestBed.inject(AgentChatStorage);
    storage.write('000004', { open: true, turns: [turn(1), turn(2)] });
    expect(sessionStorage.getItem(KEY)).not.toBeNull();
    expect(storage.read('000004')).toEqual({
      open: true,
      turns: [turn(1), turn(2)],
    });
    expect(storage.read('000005')).toEqual({ open: false, turns: [] });
  });

  it('keeps the newest 30 turns', () => {
    const storage = TestBed.inject(AgentChatStorage);
    const turns = Array.from({ length: 35 }, (_, i) => turn(i + 1));
    storage.write('000004', { open: false, turns });
    const read = storage.read('000004').turns;
    expect(read).toHaveLength(30);
    expect(read[0].id).toBe(6);
    expect(read.at(-1)?.id).toBe(35);
  });

  it.each([
    'not json',
    'null',
    '[]',
    '{"open":true}',
    '{"open":true,"turns":[{"id":1}]}',
  ])('discards the entry %s and starts empty', (entry) => {
    sessionStorage.setItem(KEY, entry);
    expect(TestBed.inject(AgentChatStorage).read('000004')).toEqual({
      open: false,
      turns: [],
    });
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('restores a turn that was still streaming as stopped, and a card that was confirming as pending', () => {
    const storage = TestBed.inject(AgentChatStorage);
    storage.write('000004', {
      open: true,
      turns: [
        turn(1, { status: 'composing', text: 'Một nửa' }),
        turn(2, { status: 'done', action: card('confirming') }),
        turn(3, { status: 'done', action: card('confirmed') }),
      ],
    });
    const turns = storage.read('000004').turns;
    expect(turns[0].reply).toMatchObject({
      status: 'stopped',
      text: 'Một nửa',
    });
    expect(turns[1].reply.action?.status).toBe('pending');
    expect(turns[2].reply.action?.status).toBe('confirmed');
  });

  it('removes the entry on clear', () => {
    const storage = TestBed.inject(AgentChatStorage);
    storage.write('000004', { open: true, turns: [turn(1)] });
    storage.clear('000004');
    expect(sessionStorage.getItem(KEY)).toBeNull();
    expect(storage.read('000004').turns).toEqual([]);
  });

  it('removes every other user’s conversation and leaves this user’s and other keys', () => {
    const storage = TestBed.inject(AgentChatStorage);
    storage.write('000004', { open: true, turns: [turn(1)] });
    storage.write('000005', { open: true, turns: [turn(1)] });
    sessionStorage.setItem('lms.agent-chat.v1.000006', '{}');
    sessionStorage.setItem('lms.other', 'kept');

    storage.clearOthers('000004');

    expect(sessionStorage.getItem(KEY)).not.toBeNull();
    expect(sessionStorage.getItem('lms.agent-chat.v1.000005')).toBeNull();
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
      storage.write('000004', { open: true, turns: [turn(1)] });
      expect(storage.read('000004')).toEqual({ open: true, turns: [turn(1)] });
      storage.clear('000004');
      expect(storage.read('000004').turns).toEqual([]);
      storage.write('000005', { open: true, turns: [turn(1)] });
      storage.clearOthers('000004');
      expect(storage.read('000005').turns).toEqual([]);
    }
  });
});
