import { UNAUTHENTICATED_CODE, type Envelope } from '@lms/contracts';
import { envelopeError } from './envelope';

/**
 * Mock-only: stands in for every refusal code of the backend (duplicate email, locked account,
 * record not found…). Unconfirmed with the backend; only `CORE-0401` is a real code. When a screen
 * needs to branch on a code, the real one goes into `MESSAGE_CODE_KIND` and replaces it here.
 */
export const MOCK_REFUSAL_CODE = 'CORE-9999';

/** An `ERROR` envelope for a refusal the backend explains with a title and a message. */
export function refusal(messageTitle: string, message: string): Envelope {
  return envelopeError(MOCK_REFUSAL_CODE, messageTitle, message);
}

/** The backend ended the session (the real `CORE-0401`). */
export const sessionExpired: Envelope = envelopeError(
  UNAUTHENTICATED_CODE,
  'Cần đăng nhập',
  'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
);
