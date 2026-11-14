import { toUrl } from '../http/endpoint';
import { trainingCatalogEndpoints } from './training-catalog.endpoints';
import {
  BusinessModuleSchema,
  CatalogTreeSchema,
  ListCatalogTreeQuerySchema,
  ListByOwnerOrgQuerySchema,
  SaveCatalogItemCommandSchema,
  TrainingProgramSchema,
} from './training-catalog.schema';

describe('training catalog endpoints', () => {
  it('declare the backend paths and methods', () => {
    expect(
      Object.entries(trainingCatalogEndpoints).map(([key, e]) => [
        key,
        e.method,
        e.path,
      ]),
    ).toEqual([
      ['listFields', 'get', '/api/v1/training-catalog/fields'],
      ['createField', 'post', '/api/v1/training-catalog/fields'],
      ['updateField', 'put', '/api/v1/training-catalog/fields/{id}'],
      ['listPrograms', 'get', '/api/v1/training-catalog/programs'],
      ['createProgram', 'post', '/api/v1/training-catalog/programs'],
      ['updateProgram', 'put', '/api/v1/training-catalog/programs/{id}'],
      ['listModules', 'get', '/api/v1/training-catalog/modules'],
      ['createModule', 'post', '/api/v1/training-catalog/modules'],
      ['updateModule', 'put', '/api/v1/training-catalog/modules/{id}'],
      ['tree', 'get', '/api/v1/training-catalog/tree'],
      ['copyProgram', 'post', '/api/v1/training-catalog/programs/{id}/copy'],
      ['deleteField', 'delete', '/api/v1/training-catalog/fields/{id}'],
      ['deleteProgram', 'delete', '/api/v1/training-catalog/programs/{id}'],
      ['deleteModule', 'delete', '/api/v1/training-catalog/modules/{id}'],
    ]);
    expect(toUrl(trainingCatalogEndpoints.updateProgram, { id: 4 })).toBe(
      '/api/v1/training-catalog/programs/4',
    );
  });

  it('requires the owner org to list', () => {
    expect(ListByOwnerOrgQuerySchema.safeParse({ page: 0 }).success).toBe(
      false,
    );
    expect(ListByOwnerOrgQuerySchema.parse({ ownerOrgId: 1 })).toEqual({
      ownerOrgId: 1,
    });
  });

  it('checks the save body against the backend rules', () => {
    const body = {
      ownerOrgId: 1,
      code: 'CT-01',
      name: 'Chương trình Core Banking',
      status: 'draft',
    };
    expect(SaveCatalogItemCommandSchema.parse(body)).toEqual(body);
    expect(
      SaveCatalogItemCommandSchema.safeParse({ ...body, status: 'active' })
        .success,
    ).toBe(false);
    expect(
      SaveCatalogItemCommandSchema.safeParse({ ...body, code: 'x'.repeat(51) })
        .success,
    ).toBe(false);
  });

  it('parses rows as the backend sends them', () => {
    expect(
      TrainingProgramSchema.parse({
        id: 4,
        fieldId: null,
        ownerOrgId: 1,
        code: 'CT-01',
        name: 'Chương trình Core Banking',
        description: null,
        status: 'published',
        sortNo: 0,
        copiedFromProgramId: null,
        rowVersion: 2,
        createTime: '2026-10-20T08:00:00',
        updateTime: '2026-10-21T08:00:00+07:00',
      }).rowVersion,
    ).toBe(2);
    expect(
      BusinessModuleSchema.parse({
        id: 9,
        fieldId: 3,
        code: 'TG',
        name: 'Tiền gửi',
        status: 'draft',
        rowVersion: 0,
      }).fieldId,
    ).toBe(3);
  });

  describe('tree', () => {
    const tree = {
      fields: [
        {
          id: 1,
          ownerOrgId: 7,
          code: 'NV',
          name: 'Nghiệp vụ',
          description: null,
          status: 'published',
          sortNo: 0,
          rowVersion: 3,
          programs: [
            {
              id: 4,
              fieldId: 1,
              ownerOrgId: 7,
              code: 'NV-01',
              name: 'Tiền gửi',
              description: 'Mô tả',
              status: 'draft',
              sortNo: 1,
              rowVersion: 0,
              courses: [
                {
                  id: 9,
                  code: 'C-1',
                  title: 'Khóa 1',
                  lifecycleStatus: 'active',
                  published: true,
                },
              ],
            },
          ],
        },
      ],
    };

    it('parses the nested response the backend sends', () => {
      const parsed = CatalogTreeSchema.parse(tree);
      expect(parsed.fields[0].programs[0].courses[0].title).toBe('Khóa 1');
      expect(parsed.fields[0].programs[0].rowVersion).toBe(0);
    });

    it('refuses a course status the backend does not use', () => {
      const bad = structuredClone(tree);
      bad.fields[0].programs[0].courses[0].lifecycleStatus = 'published';
      expect(CatalogTreeSchema.safeParse(bad).success).toBe(false);
    });

    it('requires the owner org to read the tree', () => {
      expect(ListCatalogTreeQuerySchema.safeParse({}).success).toBe(false);
      expect(ListCatalogTreeQuerySchema.parse({ ownerOrgId: 7 })).toEqual({
        ownerOrgId: 7,
      });
    });

    it('deletes with the row version, answering no data', () => {
      expect(toUrl(trainingCatalogEndpoints.deleteProgram, { id: 4 })).toBe(
        '/api/v1/training-catalog/programs/4',
      );
      expect(trainingCatalogEndpoints.deleteField.query).toBeDefined();
      expect(trainingCatalogEndpoints.deleteField.response.parse(null)).toBe(
        null,
      );
    });
  });
});
