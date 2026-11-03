import type { TargetInput, TargetType } from '@lms/contracts';

/** UI copy for the assignment target types; the mockup's wording where it has one. */
export const TARGET_TYPE_LABEL: Record<TargetType, string> = {
  user: 'Cá nhân',
  team: 'Phòng/nhóm',
  org: 'Đơn vị',
  learning_group: 'Nhóm học tập',
};

/** A chosen target with the name the form shows for it. */
export type TargetPick = TargetInput & { readonly label: string };

/** The same target, whatever its label: two picks of one person, team, unit or group are one. */
export const sameTarget = (a: TargetInput, b: TargetInput): boolean =>
  a.targetType === b.targetType &&
  a.userId === b.userId &&
  a.teamId === b.teamId &&
  a.orgId === b.orgId &&
  a.groupId === b.groupId;

/** The target as the server takes it: the pick without its label. */
export const toTargetInput = ({ label: _label, ...target }: TargetPick) =>
  target;
