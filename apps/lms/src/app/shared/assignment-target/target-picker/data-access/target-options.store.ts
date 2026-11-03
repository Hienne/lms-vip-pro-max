import {
  computed,
  inject,
  Injectable,
  InjectionToken,
  signal,
} from '@angular/core';
import type { Signal } from '@angular/core';
import {
  assignmentEndpoints,
  identityEndpoints,
  MAX_PAGE_SIZE,
  organizationEndpoints,
} from '@lms/contracts';
import { serverData } from '../../../../core/data-access/server-data';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { SessionStore } from '../../../../core/session/session.store';

/**
 * The org whose learning groups the picker offers. A host that assigns on behalf of another org
 * than the caller's (the course editor: the course's owner) provides it; without it the caller's
 * org is used.
 */
export const TARGET_OWNER_ORG = new InjectionToken<Signal<number | undefined>>(
  'TARGET_OWNER_ORG',
);

/**
 * The options of the target picker: the people, orgs and learning groups in the caller's scope,
 * and the teams of the org the picker has chosen. One page of each is enough for the selects.
 * Provided by the picker, so every host gets its own.
 */
@Injectable()
export class TargetOptionsStore {
  private readonly client = inject(EndpointClient);
  private readonly session = inject(SessionStore);
  private readonly hostOrgId = inject(TARGET_OWNER_ORG, { optional: true });

  private readonly state = {
    /** The org whose teams are offered. */
    teamOrgId: signal<number | undefined>(undefined),
  };

  private readonly ownerOrgId = computed(
    () => this.hostOrgId?.() ?? this.session.user$()?.org?.id,
  );

  private readonly peopleData = serverData(() =>
    this.client.call(identityEndpoints.listUsers, {
      query: { size: MAX_PAGE_SIZE, sort: 'fullName,asc', status: 'active' },
    }),
  );

  private readonly orgsData = serverData(() =>
    this.client.call(organizationEndpoints.listOrgs, {
      query: { size: MAX_PAGE_SIZE, sort: 'name,asc' },
    }),
  );

  private readonly teamsData = serverData(
    (orgId: number) =>
      this.client.call(organizationEndpoints.listTeams, {
        params: { orgId },
        query: { size: MAX_PAGE_SIZE, sort: 'name,asc' },
      }),
    { params: () => this.state.teamOrgId() },
  );

  private readonly groupsData = serverData(
    (ownerOrgId: number) =>
      this.client.call(assignmentEndpoints.listGroups, {
        query: { ownerOrgId, size: MAX_PAGE_SIZE },
      }),
    { params: () => this.ownerOrgId() },
  );

  // Selectors
  readonly people$ = computed(() => this.peopleData.value()?.items ?? []);
  readonly orgs$ = computed(() => this.orgsData.value()?.items ?? []);
  readonly teams$ = computed(() => this.teamsData.value()?.items ?? []);
  readonly groups$ = computed(() => this.groupsData.value()?.items ?? []);

  // Setters
  private setTeamOrgId(orgId: number | undefined): void {
    this.state.teamOrgId.set(orgId);
  }

  // Commands
  /** The picker's org changed: offer that org's teams. */
  pickTeamOrg(orgId: number | undefined): void {
    this.setTeamOrgId(orgId);
  }
}
