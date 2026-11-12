import type { StoredAction, StoredTurn } from '@lms/contracts';
import type { ActionCard, AgentTurn } from './agent-chat.model';

/** What a turn that ended in an error shows after a reload; the server keeps no message for it. */
export const STORED_ERROR_MESSAGE =
  'Lượt này chưa trả lời được. Bạn thử lại nhé.';

/** What an answered card says when the server kept no text (rows from before it stored one). */
const OUTCOME_DEFAULTS: Partial<Record<StoredAction['status'], string>> = {
  confirmed: 'Đã áp dụng thay đổi.',
  cancelled: 'Đã huỷ thay đổi',
  expired: 'Đề xuất đã hết hạn',
  failed: 'Không thực hiện được thay đổi.',
};

/** A stored card as the panel's card: the same fields, the status being the server's today. */
function cardOf(action: StoredAction): ActionCard {
  const { status, message, ...pending } = action;
  return {
    pending,
    status,
    message: message?.trim() ? message : (OUTCOME_DEFAULTS[status] ?? null),
  };
}

/**
 * A turn the server saved, as the quick chat shows it. The text, sources, opened screen and the
 * card's state are all the server's; nothing is recomputed here, so a card that expired or was
 * confirmed in another tab reads that way.
 */
export function turnFromStored(turn: StoredTurn): AgentTurn {
  return {
    id: turn.id,
    serverTurnId: turn.id,
    feedback: turn.feedback,
    question: turn.question,
    reply: {
      status:
        turn.status === 'done'
          ? 'done'
          : turn.status === 'stopped'
            ? 'stopped'
            : 'error',
      toolName: null,
      text: turn.answer ?? '',
      citations: turn.citations,
      grounded: turn.grounded,
      navigatedTo: turn.navigation,
      action: turn.action ? cardOf(turn.action) : null,
      error: turn.status === 'error' ? STORED_ERROR_MESSAGE : null,
    },
  };
}
