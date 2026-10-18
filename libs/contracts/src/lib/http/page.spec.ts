import { z } from 'zod';
import { MAX_PAGE_SIZE, PageQuerySchema, PageSchema } from './page';

const page = {
  items: [{ id: 1 }],
  page: 0,
  size: 20,
  totalElements: 1,
  totalPages: 1,
};

describe('PageSchema', () => {
  const schema = PageSchema(z.object({ id: z.number() }));

  it('accepts the backend PageResponse', () => {
    expect(schema.parse(page)).toEqual(page);
  });

  it.each([
    { ...page, page: -1 },
    { ...page, size: 0 },
    { ...page, totalElements: 1.5 },
    { ...page, items: [{ id: 'x' }] },
    { items: [] },
  ])('rejects %j', (body) => {
    expect(schema.safeParse(body).success).toBe(false);
  });
});

describe('PageQuerySchema', () => {
  it('takes a 0-based page and a size of 1 to 100', () => {
    expect(
      PageQuerySchema.safeParse({ page: 0, size: MAX_PAGE_SIZE }).success,
    ).toBe(true);
    expect(PageQuerySchema.safeParse({ page: -1 }).success).toBe(false);
    expect(PageQuerySchema.safeParse({ size: 0 }).success).toBe(false);
    expect(PageQuerySchema.safeParse({ size: MAX_PAGE_SIZE + 1 }).success).toBe(
      false,
    );
  });
});
