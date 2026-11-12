import { describe, expect, it } from 'vitest';
import {
  ConversationDetailSchema,
  RateAnswerCommandSchema,
  RenameConversationCommandSchema,
  StoredTurnSchema,
} from './conversation.schema';

const TIME = '2026-11-10T09:00:00Z';

const turn = {
  id: 1,
  surface: 'AGENT',
  question: 'Đổi chức danh thành Trưởng nhóm',
  answer: 'Vui lòng kiểm tra và xác nhận.',
  citations: [],
  toolNames: ['update_profile'],
  navigation: null,
  actionId: 'a1',
  action: {
    id: 'a1',
    tool: 'update_profile',
    title: 'Cập nhật hồ sơ cá nhân',
    changes: [
      {
        field: 'positionName',
        label: 'Chức danh',
        from: 'Chuyên viên',
        to: 'Trưởng nhóm',
      },
    ],
    status: 'expired',
    expiresAt: TIME,
    message: null,
  },
  feedback: null,
  status: 'done',
  createTime: TIME,
};

describe('StoredTurnSchema', () => {
  it('accepts a turn with its card in any server state', () => {
    for (const status of [
      'pending',
      'confirmed',
      'cancelled',
      'expired',
      'failed',
    ]) {
      const parsed = StoredTurnSchema.safeParse({
        ...turn,
        action: { ...turn.action, status },
      });
      expect(parsed.success, status).toBe(true);
    }
  });

  it('keeps grounded false on a stored turn and parses one without it', () => {
    expect(StoredTurnSchema.parse({ ...turn, grounded: false })).toMatchObject({
      grounded: false,
    });
    expect(StoredTurnSchema.parse(turn)).not.toHaveProperty('grounded');
  });

  it('accepts a turn without an answer or a card', () => {
    const parsed = StoredTurnSchema.safeParse({
      ...turn,
      answer: null,
      actionId: null,
      action: null,
      status: 'stopped',
    });
    expect(parsed.success).toBe(true);
  });

  it('carries the user’s own feedback, with a reason only on a thumbs-down', () => {
    const rated = StoredTurnSchema.safeParse({
      ...turn,
      feedback: { helpful: false, reasonCode: 'missing_source', note: 'Thiếu' },
    });
    expect(rated.success).toBe(true);
    const unknownReason = StoredTurnSchema.safeParse({
      ...turn,
      feedback: { helpful: false, reasonCode: 'rude', note: null },
    });
    expect(unknownReason.success).toBe(false);
    expect(RateAnswerCommandSchema.safeParse({ helpful: true }).success).toBe(
      true,
    );
    expect(
      RateAnswerCommandSchema.safeParse({
        helpful: false,
        note: 'x'.repeat(2001),
      }).success,
    ).toBe(false);
  });

  it('refuses a card of a tool the app cannot show', () => {
    const parsed = StoredTurnSchema.safeParse({
      ...turn,
      action: { ...turn.action, tool: 'delete_everything' },
    });
    expect(parsed.success).toBe(false);
  });
});

describe('ConversationDetailSchema', () => {
  it('parses a conversation with its turns', () => {
    const parsed = ConversationDetailSchema.parse({
      id: 7,
      title: 'Đổi chức danh',
      lastActivityTime: TIME,
      createTime: TIME,
      turns: [turn],
    });
    expect(parsed.turns[0]?.action?.status).toBe('expired');
  });
});

describe('RenameConversationCommandSchema', () => {
  it('trims and holds the title to 1..80 characters', () => {
    expect(
      RenameConversationCommandSchema.parse({ title: '  Mới ' }).title,
    ).toBe('Mới');
    expect(
      RenameConversationCommandSchema.safeParse({ title: '   ' }).success,
    ).toBe(false);
    expect(
      RenameConversationCommandSchema.safeParse({ title: 'x'.repeat(81) })
        .success,
    ).toBe(false);
  });
});
