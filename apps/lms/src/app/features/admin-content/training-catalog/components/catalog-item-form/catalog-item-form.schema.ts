import { CATALOG_LIMITS, CatalogStatusSchema } from '@lms/contracts';
import { z } from 'zod';
import type { CatalogItem } from '../../data-access/training-catalog.store';

/** The catalogue form: code and name required. A module's field is required by the form itself. */
export const CatalogItemFormSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, { error: 'Nhập mã.' })
    .max(CATALOG_LIMITS.code, {
      error: `Mã tối đa ${CATALOG_LIMITS.code} ký tự.`,
    }),
  name: z
    .string()
    .trim()
    .min(1, { error: 'Nhập tên.' })
    .max(CATALOG_LIMITS.name, {
      error: `Tên tối đa ${CATALOG_LIMITS.name} ký tự.`,
    }),
  description: z.string().max(CATALOG_LIMITS.description, {
    error: `Mô tả tối đa ${CATALOG_LIMITS.description} ký tự.`,
  }),
  fieldId: z.string(),
  status: CatalogStatusSchema,
});
export type CatalogItemFormValue = z.infer<typeof CatalogItemFormSchema>;

export function toCatalogItemFormValue(
  item: CatalogItem | null,
  defaultFieldId: number | undefined,
): CatalogItemFormValue {
  return {
    code: item?.code ?? '',
    name: item?.name ?? '',
    description: item?.description ?? '',
    fieldId: String(item?.fieldId ?? defaultFieldId ?? ''),
    status: item?.status ?? 'draft',
  };
}
