import { z } from 'zod';

/** The most rows the backend returns in one page; larger `size` values are refused. */
export const MAX_PAGE_SIZE = 100;

/**
 * A server-side page, as the backend's `PageResponse<T>` sends it inside an envelope's `data`.
 * `page` is 0-based; the backend filters by the caller's scope before it counts the totals.
 */
export const PageSchema = <Item extends z.ZodType>(item: Item) =>
  z.object({
    items: z.array(item),
    page: z.number().int().nonnegative(),
    size: z.number().int().positive(),
    totalElements: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  });

export type Page<Item> = {
  readonly items: readonly Item[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
};

/** The query every paged list accepts: 0-based `page`, `size` 1..100, `sort` as `field,asc|desc`. */
export const PageQuerySchema = z.object({
  page: z.number().int().nonnegative().optional(),
  size: z.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
  sort: z.string().optional(),
});
