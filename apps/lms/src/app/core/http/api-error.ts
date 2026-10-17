/**
 * The backend answered, on purpose, with an `ERROR` envelope. Not a transport failure and not a
 * contract bug: it carries the backend's own code, title and message for the user. The envelope
 * arrives in an HTTP 200 (validation, business rules) or in the body of a 4xx/5xx
 * (authentication, permission, protocol, system); `httpStatus` says which.
 */
export class ApiError extends Error {
  constructor(
    readonly messageCode: string,
    readonly title: string | undefined,
    /** The backend's message, absent when it sent none. */
    readonly serverMessage: string | undefined,
    readonly httpStatus = 200,
    /** The call's `responseId` (the `X-Request-Id` we sent); quote it to support. */
    readonly responseId?: string,
  ) {
    super(serverMessage ?? title ?? messageCode);
    this.name = 'ApiError';
  }
}
