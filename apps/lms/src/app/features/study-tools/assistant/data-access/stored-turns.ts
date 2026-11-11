import type { StoredTurn } from '@lms/contracts';
import type { Turn } from './assistant.model';

/** What a turn that ended in an error shows after it was saved; the server keeps no message for it. */
export const STORED_ERROR_MESSAGE =
  'Lượt này chưa trả lời được. Bạn thử lại nhé.';

/**
 * A turn the server saved, as this page shows it. The text, sources and the card's state are the
 * server's; a turn the quick assistant stored carries its card as a read-only note.
 */
export function turnFromStored(turn: StoredTurn): Turn {
  return {
    id: turn.id,
    serverTurnId: turn.id,
    feedback: turn.feedback,
    question: turn.question,
    answer: {
      status:
        turn.status === 'done'
          ? 'done'
          : turn.status === 'stopped'
            ? 'stopped'
            : 'error',
      text: turn.answer ?? '',
      retrieved: null,
      found: null,
      citations: turn.citations,
      error: turn.status === 'error' ? STORED_ERROR_MESSAGE : null,
      action: turn.action
        ? {
            title: turn.action.title,
            status: turn.action.status,
            message: turn.action.message,
          }
        : null,
    },
  };
}
