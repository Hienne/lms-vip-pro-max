import type { StoredTurn } from '@lms/contracts';
import { turnFromStored } from './stored-turns';

function turnWith(
  status: 'pending' | 'confirmed' | 'cancelled' | 'expired' | 'failed',
  message: string | null,
): StoredTurn {
  return {
    id: 1,
    surface: 'agent',
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

describe('turnFromStored: the card outcome after a reload', () => {
  it('keeps the message the server stored', () => {
    expect(messageOf(turnWith('cancelled', 'Đã huỷ thay đổi'))).toBe(
      'Đã huỷ thay đổi',
    );
  });

  it('falls back to default copy per status when an old row has no message', () => {
    expect(messageOf(turnWith('cancelled', null))).toBe('Đã huỷ thay đổi');
    expect(messageOf(turnWith('expired', null))).toBe('Đề xuất đã hết hạn');
    expect(messageOf(turnWith('confirmed', null))).toBe(
      'Đã áp dụng thay đổi.',
    );
    expect(messageOf(turnWith('failed', ''))).toBe(
      'Không thực hiện được thay đổi.',
    );
  });

  it('leaves a pending card without a message', () => {
    expect(messageOf(turnWith('pending', null))).toBeNull();
  });
});
