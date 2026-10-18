import {
  ORG_LIMITS,
  toPatch,
  type CreateOrgCommand,
  type OrganizationInfo,
  type OrgStatus,
  type OrgType,
  type UpdateOrgCommand,
} from '@lms/contracts';
import { z } from 'zod';

/**
 * The org form: the backend's rules with Vietnamese messages. `parentId` is a select value
 * (`''` is none); a DEPARTMENT needs one. In edit mode `orgType` and `parentId` are hidden, as
 * they cannot change afterwards.
 */
export const OrgFormSchema = z
  .object({
    orgType: z.enum(['UNIT', 'DEPARTMENT']),
    parentId: z.string(),
    code: z
      .string()
      .trim()
      .min(1, { error: 'Nhập mã.' })
      .max(ORG_LIMITS.code, { error: `Mã tối đa ${ORG_LIMITS.code} ký tự.` }),
    name: z
      .string()
      .trim()
      .min(1, { error: 'Nhập tên.' })
      .max(ORG_LIMITS.name, { error: `Tên tối đa ${ORG_LIMITS.name} ký tự.` }),
    sortNo: z
      .string()
      .trim()
      .regex(/^\d{1,9}$/, { error: 'Thứ tự là số nguyên không âm.' }),
    status: z.enum(['active', 'inactive']),
  })
  .refine((v) => v.orgType === 'UNIT' || v.parentId !== '', {
    path: ['parentId'],
    error: 'Phòng phải thuộc một đơn vị.',
  });
export type OrgFormValue = z.infer<typeof OrgFormSchema>;

export function toOrgFormValue(
  org: OrganizationInfo | null,
  parentId: number | null,
): OrgFormValue {
  return {
    orgType: (org?.orgType ?? 'UNIT') as OrgType,
    parentId: String(org ? (org.parentId ?? '') : (parentId ?? '')),
    code: org?.code ?? '',
    name: org?.name ?? '',
    sortNo: String(org?.sortNo ?? 0),
    status: (org?.status ?? 'active') as OrgStatus,
  };
}

export function toCreateOrgCommand(value: OrgFormValue): CreateOrgCommand {
  return {
    orgType: value.orgType,
    ...(value.parentId ? { parentId: Number(value.parentId) } : {}),
    code: value.code.trim(),
    name: value.name.trim(),
    sortNo: Number(value.sortNo),
  };
}

/** The PATCH body: changed fields only; `status` only when the caller may set it. */
export function toUpdateOrgCommand(
  org: OrganizationInfo,
  value: OrgFormValue,
  canSetStatus: boolean,
): UpdateOrgCommand {
  const fields = canSetStatus
    ? (['code', 'name', 'sortNo', 'status'] as const)
    : (['code', 'name', 'sortNo'] as const);
  return toPatch(
    { code: org.code, name: org.name, sortNo: org.sortNo, status: org.status },
    {
      code: value.code.trim(),
      name: value.name.trim(),
      sortNo: Number(value.sortNo),
      status: value.status,
    },
    fields,
  );
}
