import { computed, inject, Injectable } from '@angular/core';
import {
  authV1Endpoints,
  learnerEndpoints,
  type Badge,
  type LearnerPreferences,
  type UpdateMeCommand,
} from '@lms/contracts';
import { registeredIcon, type IconName } from '@lms/ui';
import { MyLevelStore } from '../../../../core/learning/my-level.store';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { SessionStore } from '../../../../core/session/session.store';
import { scopeLabel } from '../../../../shared/status/scope-label';

/** A badge as the grid shows it: the icon the app bundles, and "x/y khóa" for a programme badge. */
export interface BadgeRow {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  readonly condition: string;
  readonly icon: IconName;
  readonly earnedAt: string | null;
  readonly retired: boolean;
  readonly courses: string | null;
}

function badgeRow(badge: Badge): BadgeRow {
  return {
    id: badge.badgeId,
    name: badge.name,
    description: badge.description,
    condition: badge.condition,
    icon: registeredIcon(badge.icon, 'award'),
    earnedAt: badge.earnedAt,
    retired: badge.retired,
    courses: badge.progress
      ? `${badge.progress.done}/${badge.progress.total} khóa`
      : null,
  };
}

/**
 * The profile page: the signed-in user from the session, and the one command it offers, saving
 * the personal fields. The backend answers the refreshed `/me`, which becomes the signed-in
 * user. A refusal shows its message as a toast and leaves the form as it was.
 * Changing the password is `PasswordChangeStore`, shared with the forced change.
 */
@Injectable()
export class ProfileStore {
  private readonly client = inject(EndpointClient);
  private readonly session = inject(SessionStore);
  private readonly myLevel = inject(MyLevelStore);

  private readonly saveMutation = serverMutation(
    (command: UpdateMeCommand) =>
      this.client.call(authV1Endpoints.updateMe, { body: command }),
    {
      errors: 'toast',
      success: () => 'Đã lưu hồ sơ',
      onSuccess: (me) => this.session.apply(me),
    },
  );

  /** Params that skip the call for anyone who is not a learner. */
  private learnerParams(): { userId: string } | undefined {
    const user = this.session.user$();
    const isLearner = user?.grants.some(
      (grant) => grant.roleCode === 'LEARNER' && grant.scope.type === 'OWN',
    );
    return user && isLearner ? { userId: user.userId } : undefined;
  }

  private readonly badgeData = serverData(
    () => this.client.call(learnerEndpoints.myBadges),
    {
      params: () => this.learnerParams(),
    },
  );

  private readonly preferenceData = serverData(
    () => this.client.call(learnerEndpoints.myPreferences),
    { params: () => this.learnerParams() },
  );

  private readonly preferenceMutation = serverMutation(
    (command: LearnerPreferences) =>
      this.client.call(learnerEndpoints.updateMyPreferences, {
        body: command,
      }),
    {
      errors: 'toast',
      success: () => 'Đã lưu lựa chọn',
      onSuccess: () => this.preferenceData.reload(),
    },
  );

  readonly user$ = this.session.user$;
  /** The learner's level from the server; undefined for anyone who has none or while it loads. */
  readonly level$ = this.myLevel.level$;
  /** The badges the learner earned, newest first; empty while loading or for anyone who has none. */
  readonly earnedBadges$ = computed(
    () => this.badgeData.value()?.earned.map(badgeRow) ?? [],
  );
  /** The badges still to earn, each with its condition; the server's order. */
  readonly pendingBadges$ = computed(
    () => this.badgeData.value()?.notEarned.map(badgeRow) ?? [],
  );
  /** A learner has a badge section once the server has answered; anyone else has none. */
  readonly hasBadges$ = computed(() => this.badgeData.value() !== undefined);
  readonly badgesError$ = this.badgeData.error;

  /** A learner has the leaderboard choice once the server has answered; anyone else has none. */
  readonly hasPreferences$ = computed(
    () => this.preferenceData.value() !== undefined,
  );
  /** Whether the learner's name shows on other learners' leaderboards. */
  readonly showOnLeaderboard$ = computed(
    () => this.preferenceData.value()?.showOnLeaderboard ?? true,
  );
  readonly isSavingPreference$ = this.preferenceMutation.isPending;

  setShowOnLeaderboard(show: boolean): void {
    this.preferenceMutation.run({ showOnLeaderboard: show });
  }

  retryBadges(): void {
    this.badgeData.reload();
  }

  /** Accounts synced from SSO are read-only here: the source system owns their fields. */
  readonly readOnly$ = computed(() => this.user$()?.authProvider === 'SSO');
  readonly isSaving$ = this.saveMutation.isPending;

  /** One badge per distinct role, as a user with two grants of one role shows it once. */
  readonly roles$ = computed(() => {
    const seen = new Map<string, string>();
    for (const grant of this.user$()?.grants ?? []) {
      seen.set(grant.roleCode, grant.roleName);
    }
    return [...seen].map(([code, name]) => ({ code, name }));
  });

  /** The functions granted to the user, in the sidebar's order. */
  readonly menuItems$ = computed(() =>
    (this.user$()?.nav ?? []).flatMap((section) => section.items),
  );

  readonly grants$ = computed(() => {
    const user = this.user$();
    return (user?.grants ?? []).map((grant) => ({
      roleName: grant.roleName,
      scope: scopeLabel(grant.scope, {
        orgName: grant.scope.orgId === user?.org?.id ? user?.org?.name : null,
        teamName:
          grant.scope.teamId === user?.team?.id ? user?.team?.name : null,
      }),
    }));
  });

  save(command: UpdateMeCommand): void {
    this.saveMutation.run(command);
  }
}
