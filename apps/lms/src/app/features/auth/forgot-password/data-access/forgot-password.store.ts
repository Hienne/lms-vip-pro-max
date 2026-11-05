import { inject, Injectable, signal } from '@angular/core';
import {
  identityEndpoints,
  type PasswordResetRequestCommand,
} from '@lms/contracts';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';

/**
 * The forgot-password page: the request a visitor sends. The server answers the same message
 * whether or not the staff code has an account, so the page shows that message and nothing else.
 */
@Injectable()
export class ForgotPasswordStore {
  private readonly client = inject(EndpointClient);

  private readonly state = {
    /** The server's confirmation; set once the request went through. */
    message: signal<string | null>(null),
  };

  private readonly request = serverMutation(
    (command: PasswordResetRequestCommand) =>
      this.client.call(identityEndpoints.passwordResetRequest, {
        body: command,
      }),
    {
      errors: 'alert',
      onSuccess: (result) => this.setMessage(result.message),
    },
  );

  readonly isSending$ = this.request.isPending;
  readonly error$ = this.request.error;
  /** The confirmation after a sent request; the form is replaced by it. */
  readonly message$ = this.state.message.asReadonly();

  private setMessage(message: string | null): void {
    this.state.message.set(message);
  }

  send(command: PasswordResetRequestCommand): void {
    this.request.run(command);
  }
}
