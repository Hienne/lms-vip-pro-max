import { computed, inject, Injectable } from '@angular/core';
import { learnerEndpoints } from '@lms/contracts';
import { serverData } from '../data-access/server-data';
import { EndpointClient } from '../http/endpoint-client';
import { SessionStore } from '../session/session.store';

/**
 * The signed-in learner's level, read once for the header menu and the profile. Only a learner has one
 * (a `LEARNER` grant at `OWN` scope), so anyone else costs no request. The level is the server's; this only
 * holds it.
 */
@Injectable({ providedIn: 'root' })
export class MyLevelStore {
  private readonly client = inject(EndpointClient);
  private readonly session = inject(SessionStore);

  private readonly levelData = serverData(
    () => this.client.call(learnerEndpoints.myLevel),
    {
      params: () => {
        const user = this.session.user$();
        const isLearner = user?.grants.some(
          (grant) => grant.roleCode === 'LEARNER' && grant.scope.type === 'OWN',
        );
        return user && isLearner ? { userId: user.userId } : undefined;
      },
    },
  );

  readonly level$ = this.levelData.value;
  readonly error$ = this.levelData.error;
  readonly name$ = computed(() => this.levelData.value()?.name ?? null);
}
