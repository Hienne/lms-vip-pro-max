import { CATALOG_LIMITS } from '@lms/contracts';
import { z } from 'zod';

/** The catalogue form: code and name required. The status is changed by its own buttons. */
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
});
export type CatalogItemFormValue = z.infer<typeof CatalogItemFormSchema>;

export function toCatalogItemFormValue(
  item: {
    readonly code: string;
    readonly name: string;
    readonly description?: string | null;
  } | null,
): CatalogItemFormValue {
  return {
    code: item?.code ?? '',
    name: item?.name ?? '',
    description: item?.description ?? '',
  };
}
