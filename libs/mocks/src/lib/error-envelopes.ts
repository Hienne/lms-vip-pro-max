import type { Envelope } from '@lms/contracts';
import { envelopeError } from './envelope';

/**
 * Placeholder code for the endpoints the backend lacks (roles CRUD, a user's courses, attempts
 * and audit): `FakeBackend` refuses with it. Backend-backed endpoints use
 * `backendRefusal`, which carries the real codes.
 */
export const MOCK_REFUSAL_CODE = 'CORE-9999';

/** An `ERROR` envelope for a refusal the backend explains with a title and a message. */
export function refusal(messageTitle: string, message: string): Envelope {
  return envelopeError(MOCK_REFUSAL_CODE, messageTitle, message);
}
