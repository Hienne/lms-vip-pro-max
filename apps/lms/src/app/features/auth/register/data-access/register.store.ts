import { computed, inject, Injectable, signal } from '@angular/core';
import { identityEndpoints, type RegisterRequestCommand } from '@lms/contracts';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';

/**
 * The registration page: the units a visitor can choose, and the request they send. The server
 * answers the same message for any staff code, so the page shows that message and nothing about
 * whether the code exists.
 */
@Injectable()
export class RegisterStore {
  private readonly client = inject(EndpointClient);

  private readonly state = {
    /** The server's confirmation; set once the request went through. */
    message: signal<string | null>(null),
  };

  private readonly unitsData = serverData(() =>
    this.client.call(identityEndpoints.registrationUnits),
  );

  private readonly registration = serverMutation(
    (command: RegisterRequestCommand) =>
      this.client.call(identityEndpoints.registerRequest, { body: command }),
    {
      errors: 'alert',
      onSuccess: (result) => this.setMessage(result.message),
    },
  );

  readonly units$ = computed(() => this.unitsData.value() ?? []);
  readonly isLoadingUnits$ = this.unitsData.isLoading;
  readonly unitsError$ = this.unitsData.error;
  readonly isSending$ = this.registration.isPending;
  readonly error$ = this.registration.error;
  /** The confirmation after a sent request; the form is replaced by it. */
  readonly message$ = this.state.message.asReadonly();

  private setMessage(message: string | null): void {
    this.state.message.set(message);
  }

  loadUnitsAgain(): void {
    this.unitsData.reload();
  }

  send(command: RegisterRequestCommand): void {
    this.registration.run(command);
  }
}
