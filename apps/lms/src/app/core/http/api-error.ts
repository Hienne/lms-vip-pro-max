/**
 * The backend answered, on purpose, with an `ERROR` envelope. Not a transport failure and not a
 * contract bug: it carries the backend's own code, title and message for the user.
 */
export class ApiError extends Error {
  constructor(
    readonly messageCode: string,
    readonly title: string | undefined,
    /** The backend's message, absent when it sent none. */
    readonly serverMessage: string | undefined,
  ) {
    super(serverMessage ?? title ?? messageCode);
    this.name = 'ApiError';
  }
}
