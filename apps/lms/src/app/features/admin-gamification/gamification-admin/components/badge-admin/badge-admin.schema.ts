import {
  SaveBadgeCommandSchema,
  type AdminBadge,
  type BadgeRuleType,
  type SaveBadgeCommand,
} from '@lms/contracts';
import { z } from 'zod';

/** The badge form as typed: counts and the programme are text until they are sent. */
export interface BadgeFormValue {
  name: string;
  description: string;
  icon: string;
  ruleType: BadgeRuleType;
  paramN: string;
  paramProgramId: string;
}

export const RULE_LABEL: Record<BadgeRuleType, string> = {
  COURSES_COMPLETED: 'Hoàn thành N khóa học',
  PROGRAM_COMPLETED: 'Hoàn thành một chương trình',
  FIRST_TRY_PERFECT: 'Đạt 100% ngay lần đầu ở N bài kiểm tra',
  ASSIGNED_BEFORE_DEADLINE: 'Hoàn thành N khóa học được giao trước hạn',
  STREAK_WORKING_DAYS: 'Chuỗi N ngày làm việc liên tiếp',
};

export const RULE_TYPES = Object.keys(RULE_LABEL) as BadgeRuleType[];

export function emptyBadgeForm(): BadgeFormValue {
  return {
    name: '',
    description: '',
    icon: 'award',
    ruleType: 'COURSES_COMPLETED',
    paramN: '1',
    paramProgramId: '',
  };
}

export function toBadgeFormValue(badge: AdminBadge): BadgeFormValue {
  return {
    name: badge.name,
    description: badge.description,
    icon: badge.icon,
    ruleType: badge.ruleType,
    paramN: badge.paramN === null ? '' : String(badge.paramN),
    paramProgramId:
      badge.paramProgramId === null ? '' : String(badge.paramProgramId),
  };
}

/** The form as the contract's command; the field the rule does not use is sent as `null`. */
export function toBadgeCommand(value: BadgeFormValue): SaveBadgeCommand {
  const isProgram = value.ruleType === 'PROGRAM_COMPLETED';
  const number = (text: string) =>
    text.trim() === '' ? null : Number(text.trim());
  return {
    name: value.name,
    description: value.description,
    icon: value.icon,
    ruleType: value.ruleType,
    paramN: isProgram ? null : number(value.paramN),
    paramProgramId: isProgram ? number(value.paramProgramId) : null,
  };
}

/** The form's rules are the contract's: its issues are re-raised on the form fields. */
export const badgeFormSchema = z
  .object({
    name: z.string(),
    description: z.string(),
    icon: z.string(),
    ruleType: z.string(),
    paramN: z.string(),
    paramProgramId: z.string(),
  })
  .superRefine((value, ctx) => {
    const result = SaveBadgeCommandSchema.safeParse(
      toBadgeCommand(value as BadgeFormValue),
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
