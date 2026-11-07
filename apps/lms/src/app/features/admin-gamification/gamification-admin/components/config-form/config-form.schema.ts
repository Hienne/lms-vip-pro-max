import {
  SaveGamificationConfigCommandSchema,
  type ConfigVersion,
  type SaveGamificationConfigCommand,
} from '@lms/contracts';
import { z } from 'zod';

/** One ladder row as typed: both fields are text until the form is submitted. */
export interface LevelFormRow {
  name: string;
  minXp: string;
}

/** The config form as typed. Numbers stay text so an empty field is "missing", not 0. */
export interface ConfigFormValue {
  lessonXp: string;
  quizPassXp: string;
  firstTryBonusXp: string;
  firstTryThresholdPercent: string;
  communityXp: string;
  communityDailyCap: string;
  levels: LevelFormRow[];
}

const asNumber = (text: string): number =>
  text.trim() === '' ? Number.NaN : Number(text);

/** The form's value as the contract's command; a field that is not a number becomes `NaN`, which the contract refuses. */
export function toConfigCommand(
  value: ConfigFormValue,
): SaveGamificationConfigCommand {
  return {
    lessonXp: asNumber(value.lessonXp),
    quizPassXp: asNumber(value.quizPassXp),
    firstTryBonusXp: asNumber(value.firstTryBonusXp),
    firstTryThresholdPercent: asNumber(value.firstTryThresholdPercent),
    communityXp: asNumber(value.communityXp),
    communityDailyCap: asNumber(value.communityDailyCap),
    levels: value.levels.map((level) => ({
      name: level.name,
      minXp: asNumber(level.minXp),
    })),
  };
}

/** The version in force as the form's starting value. */
export function toConfigFormValue(
  version: ConfigVersion | undefined,
): ConfigFormValue {
  return {
    lessonXp: String(version?.lessonXp ?? 0),
    quizPassXp: String(version?.quizPassXp ?? 0),
    firstTryBonusXp: String(version?.firstTryBonusXp ?? 0),
    firstTryThresholdPercent: String(version?.firstTryThresholdPercent ?? 90),
    communityXp: String(version?.communityXp ?? 0),
    communityDailyCap: String(version?.communityDailyCap ?? 0),
    levels: (version?.levels ?? [{ level: 1, name: '', minXp: 0 }]).map(
      (level) => ({ name: level.name, minXp: String(level.minXp) }),
    ),
  };
}

/**
 * The form's validation: the contract's own rules and messages (they match the server's), reported on
 * the field they belong to. The typed value is converted first, so a malformed number is one more
 * contract message.
 */
export const ConfigFormSchema = z
  .object({
    lessonXp: z.string(),
    quizPassXp: z.string(),
    firstTryBonusXp: z.string(),
    firstTryThresholdPercent: z.string(),
    communityXp: z.string(),
    communityDailyCap: z.string(),
    levels: z.array(z.object({ name: z.string(), minXp: z.string() })),
  })
  .superRefine((value, ctx) => {
    const result = SaveGamificationConfigCommandSchema.safeParse(
      toConfigCommand(value),
    );
    if (result.success) return;
    for (const issue of result.error.issues) {
      ctx.addIssue({
        code: 'custom',
        path: issue.path,
        message: issue.message,
      });
    }
  });
