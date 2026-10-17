import type { Envelope } from '@lms/contracts';

const IDENTITY = {
  responseId: '00000000-0000-4000-8000-000000000000',
  timestamp: '2026-10-16T08:00:00.000Z',
} as const;

/** A backend `SUCCESS` envelope around `data`: what every endpoint really answers with. */
export function envelopeOk(data: unknown): Envelope {
  return {
    ...IDENTITY,
    status: 'SUCCESS',
    messageCode: 'CORE-SUCCESS',
    messageTitle: 'Thành công',
    message: 'Thao tác thành công.',
    data,
  };
}

/** A backend `ERROR` envelope: `data` is `null`. The HTTP status is the caller's (see `backendRefusal`). */
export function envelopeError(
  messageCode: string,
  messageTitle: string,
  message: string,
): Envelope {
  return {
    ...IDENTITY,
    status: 'ERROR',
    messageCode,
    messageTitle,
    message,
    data: null,
  };
}
