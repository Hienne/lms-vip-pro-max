import type { StoredTurn } from '@lms/contracts';
import { turnFromStored } from './stored-turns';

function turnWith(
  status: 'pending' | 'confirmed' | 'cancelled' | 'expired' | 'failed',
  message: string | null,
): StoredTurn {
  return {
    id: 1,
    surface: 'AGENT',
    question: 'Đổi chức danh',
    answer: 'Mình đã chuẩn bị thay đổi.',
    citations: [],
    toolNames: ['update_profile'],
    navigation: null,
    actionId: 'a1',
    action: {
      id: 'a1',
      tool: 'update_profile',
      title: 'Đổi chức danh',
      changes: [],
      status,
      expiresAt: '2026-11-11T10:00:00Z',
      message,
    },
    feedback: null,
    status: 'done',
    createTime: '2026-11-11T09:00:00Z',
  } as StoredTurn;
}

const messageOf = (turn: StoredTurn) =>
  turnFromStored(turn).reply.action?.message;

describe('turnFromStored: an answer with no source', () => {
  it('carries grounded false, so the label shows again after reopening', () => {
    const stored = { ...turnWith('pending', null), grounded: false };
    expect(turnFromStored(stored).reply.grounded).toBe(false);
  });

  it('leaves grounded unset on a normal turn', () => {
    expect(
      turnFromStored(turnWith('pending', null)).reply.grounded,
    ).toBeUndefined();
  });
});

describe('turnFromStored: the card outcome after a reload', () => {
  it('keeps the message the server stored', () => {
    expect(messageOf(turnWith('cancelled', 'Đã huỷ thay đổi'))).toBe(
      'Đã huỷ thay đổi',
    );
  });

  it('falls back to default copy per status when an old row has no message', () => {
    expect(messageOf(turnWith('cancelled', null))).toBe('Đã huỷ thay đổi');
    expect(messageOf(turnWith('expired', null))).toBe('Đề xuất đã hết hạn');
    expect(messageOf(turnWith('confirmed', null))).toBe('Đã áp dụng thay đổi.');
    expect(messageOf(turnWith('failed', ''))).toBe(
      'Không thực hiện được thay đổi.',
    );
  });

  it('leaves a pending card without a message', () => {
    expect(messageOf(turnWith('pending', null))).toBeNull();
  });
});

describe('turnFromStored: a drafting step message', () => {
  it('keeps the card with the step state the server read now', () => {
    const card = { sessionId: 7, step: 2, state: 'confirmed', courseId: 40 };
    const stored = {
      ...turnWith('pending', null),
      question: '',
      action: null,
      actionId: null,
      draftingCard: card,
    } as StoredTurn;

    const turn = turnFromStored(stored);

    expect(turn.question).toBe('');
    expect(turn.reply.draftingCard).toEqual(card);
  });

  it('has no card on any other turn', () => {
    expect(
      turnFromStored(turnWith('pending', null)).reply.draftingCard,
    ).toBeNull();
  });
});
