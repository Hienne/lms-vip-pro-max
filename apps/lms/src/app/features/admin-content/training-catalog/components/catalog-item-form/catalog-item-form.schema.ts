import {
  CATALOG_LIMITS,
  CatalogStatusSchema,
  type BusinessModule,
} from '@lms/contracts';
import { z } from 'zod';

/** The catalogue form: code and name required. The status is changed by its own buttons. */
export const CatalogItemFormSchema = z
  .object({
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
    modules: z
      .array(
        z.object({
          key: z.string(),
          id: z.number().optional(),
          expectedVersion: z.number().optional(),
          code: z
            .string()
            .trim()
            .min(1, 'Nhập mã phân hệ.')
            .max(CATALOG_LIMITS.code, 'Mã tối đa 50 ký tự.'),
          name: z
            .string()
            .trim()
            .min(1, 'Nhập tên phân hệ.')
            .max(CATALOG_LIMITS.name, 'Tên tối đa 255 ký tự.'),
          status: CatalogStatusSchema,
          sortNo: z.number().int().nonnegative(),
          deleted: z.boolean(),
        }),
      )
      .max(200, 'Mỗi lần lưu tối đa 200 phân hệ.'),
  })
  .superRefine((value, context) => {
    const codes = new Set<string>();
    value.modules.forEach((module, index) => {
      if (module.deleted) return;
      const code = module.code.trim().toLocaleLowerCase();
      if (codes.has(code))
        context.addIssue({
          code: 'custom',
          path: ['modules', index, 'code'],
          message: 'Mã phân hệ bị trùng trong lĩnh vực.',
        });
      codes.add(code);
    });
  });
export type CatalogItemFormValue = z.infer<typeof CatalogItemFormSchema>;

export function toCatalogItemFormValue(
  item: {
    readonly code: string;
    readonly name: string;
    readonly description?: string | null;
  } | null,
  modules: readonly BusinessModule[] = [],
): CatalogItemFormValue {
  return {
    code: item?.code ?? '',
    name: item?.name ?? '',
    description: item?.description ?? '',
    modules: modules.map((module) => ({
      key: `module-${module.id}`,
      id: module.id,
      expectedVersion: module.rowVersion,
      code: module.code,
      name: module.name,
      status: module.status,
      sortNo: module.sortNo ?? 0,
      deleted: false,
    })),
  };
}
