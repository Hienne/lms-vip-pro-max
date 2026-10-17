import {
  ORG_LIMITS,
  toPatch,
  type CreateTeamCommand,
  type TeamInfo,
  type UpdateTeamCommand,
} from '@lms/contracts';
import { z } from 'zod';

/** The team form: the backend's rules with Vietnamese messages; an empty code or description is none. */
export const TeamFormSchema = z.object({
  code: z
    .string()
    .trim()
    .max(ORG_LIMITS.code, { error: `Mã tối đa ${ORG_LIMITS.code} ký tự.` }),
  name: z
    .string()
    .trim()
    .min(1, { error: 'Nhập tên nhóm.' })
    .max(ORG_LIMITS.name, { error: `Tên tối đa ${ORG_LIMITS.name} ký tự.` }),
  description: z
    .string()
    .trim()
    .max(ORG_LIMITS.teamDescription, {
      error: `Mô tả tối đa ${ORG_LIMITS.teamDescription} ký tự.`,
    }),
});
export type TeamFormValue = z.infer<typeof TeamFormSchema>;

export function toTeamFormValue(team: TeamInfo | null): TeamFormValue {
  return {
    code: team?.code ?? '',
    name: team?.name ?? '',
    description: team?.description ?? '',
  };
}

const blankToUndefined = (text: string) =>
  text.trim() === '' ? undefined : text.trim();
const blankToNull = (text: string) => (text.trim() === '' ? null : text.trim());

export function toCreateTeamCommand(value: TeamFormValue): CreateTeamCommand {
  return {
    code: blankToUndefined(value.code),
    name: value.name.trim(),
    description: blankToUndefined(value.description),
  };
}

/** The PATCH body: changed fields only, an emptied code or description as `null`. */
export function toUpdateTeamCommand(
  team: TeamInfo,
  value: TeamFormValue,
): UpdateTeamCommand {
  return toPatch(
    {
      code: team.code ?? null,
      name: team.name,
      description: team.description ?? null,
    },
    {
      code: blankToNull(value.code),
      name: value.name.trim(),
      description: blankToNull(value.description),
    },
    ['code', 'name', 'description'],
  );
}
