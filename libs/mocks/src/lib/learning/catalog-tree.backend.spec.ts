import {
  authV1Endpoints,
  trainingCatalogEndpoints,
  type AnyEndpoint,
  type CatalogTree,
  type TrainingField,
  type TrainingProgram,
} from '@lms/contracts';
import { FakeBackend, type FakeReply } from '../backend/fake-backend';
import { SEED_PASSWORD } from '../backend/seed';

describe('the training catalogue tree on the mock backend', () => {
  let backend: FakeBackend;
  let token: string;
  beforeEach(() => {
    backend = new FakeBackend();
    token = (
      call(authV1Endpoints.login, {
        body: { username: 'giangvien', password: SEED_PASSWORD },
      }).body.data as { accessToken: string }
    ).accessToken;
  });

  const call = (
    endpoint: AnyEndpoint,
    request: {
      params?: Record<string, string>;
      query?: Record<string, string>;
      body?: unknown;
    } = {},
  ): FakeReply =>
    backend.handle(endpoint, {
      token: endpoint === authV1Endpoints.login ? null : token,
      params: request.params ?? {},
      query: request.query ?? {},
      body: request.body,
    }) as FakeReply;

  const tree = () =>
    (
      call(trainingCatalogEndpoints.tree, { query: { ownerOrgId: '1' } }).body
        .data as CatalogTree
    ).fields;

  const create = (endpoint: AnyEndpoint, body: Record<string, unknown>) =>
    call(endpoint, {
      body: {
        ownerOrgId: 1,
        code: 'X-1',
        name: 'Mục thử',
        status: 'draft',
        ...body,
      },
    }).body.data as TrainingField & TrainingProgram;

  const emptyField = () =>
    create(trainingCatalogEndpoints.createField, { code: 'EMPTY' });
  const emptyProgram = (fieldId: number, code = 'EMPTY-P') =>
    create(trainingCatalogEndpoints.createProgram, { fieldId, code });

  it('nests programs under their field and courses under their program', () => {
    const fields = tree();
    const field = fields.find((f) => f.code === 'NV')!;
    expect(fields.map((f) => f.sortNo)).toEqual(
      [...fields.map((f) => f.sortNo)].sort((a, b) => a! - b!),
    );
    const program = field.programs.find((p) => p.code === 'NV-01')!;
    expect(program.fieldId).toBe(field.id);
    expect(program.courses.length).toBeGreaterThan(0);
    const course = program.courses[0];
    expect(course.title).toBeTruthy();
    expect(course.lifecycleStatus).toBe('active');
    expect(typeof course.published).toBe('boolean');
    expect(typeof program.rowVersion).toBe('number');
  });

  it('shows new items, empty ones included, and a status change by PUT', () => {
    const field = emptyField();
    const program = emptyProgram(field.id);
    expect(
      tree()
        .find((f) => f.id === field.id)!
        .programs.map((p) => p.id),
    ).toEqual([program.id]);

    call(trainingCatalogEndpoints.updateProgram, {
      params: { id: String(program.id) },
      query: { expectedVersion: '0' },
      body: {
        ownerOrgId: 1,
        fieldId: field.id,
        code: program.code,
        name: program.name,
        status: 'archived',
      },
    });
    expect(
      tree()
        .find((f) => f.id === field.id)!
        .programs.find((p) => p.id === program.id)!.status,
    ).toBe('archived');
  });

  it('refuses a tree for another unit', () => {
    const reply = call(trainingCatalogEndpoints.tree, {
      query: { ownerOrgId: '999' },
    });
    expect(reply.status).toBe(403);
  });

  describe('copying a program', () => {
    const copy = (id: number) =>
      call(trainingCatalogEndpoints.copyProgram, {
        params: { id: String(id) },
      });

    it('makes a draft in the same field with a draft of each course', () => {
      const source = tree()
        .flatMap((f) => f.programs)
        .find((p) => p.code === 'NV-01')!;
      const reply = copy(source.id);
      const created = reply.body.data as TrainingProgram;

      expect(created.code).toBe('NV-01-COPY');
      expect(created.name).toBe(`${source.name} (bản sao)`);
      expect(created.status).toBe('draft');
      expect(created.fieldId).toBe(source.fieldId);
      expect(created.copiedFromProgramId).toBe(source.id);

      const copied = tree()
        .flatMap((f) => f.programs)
        .find((p) => p.id === created.id)!;
      expect(copied.courses).toHaveLength(source.courses.length);
      for (const course of copied.courses) {
        expect(course.code).toMatch(/-COPY$/);
        expect(course.published).toBe(false);
      }
      expect(
        tree()
          .flatMap((f) => f.programs)
          .find((p) => p.id === source.id)!.courses,
      ).toHaveLength(source.courses.length);
    });

    it('numbers the code of a second copy and refuses an unknown id', () => {
      const source = emptyProgram(emptyField().id);
      copy(source.id);
      expect((copy(source.id).body.data as TrainingProgram).code).toBe(
        'EMPTY-P-COPY2',
      );
      expect(copy(424242).body.messageCode).toBe('CORE-RESOURCE_NOT_FOUND');
    });
  });

  describe('deleting', () => {
    const remove = (endpoint: AnyEndpoint, id: number, version: number) =>
      call(endpoint, {
        params: { id: String(id) },
        query: { expectedVersion: String(version) },
      });

    it('removes an empty program, then its empty field', () => {
      const field = emptyField();
      const program = emptyProgram(field.id);

      expect(
        remove(trainingCatalogEndpoints.deleteProgram, program.id, 0).body
          .status,
      ).toBe('SUCCESS');
      expect(tree().find((f) => f.id === field.id)!.programs).toHaveLength(0);
      expect(
        remove(trainingCatalogEndpoints.deleteField, field.id, 0).body.status,
      ).toBe('SUCCESS');
      expect(tree().some((f) => f.id === field.id)).toBe(false);
    });

    it('answers CATALOG_IN_USE for a field with programs and a program with courses', () => {
      const field = tree().find((f) => f.code === 'NV')!;
      const program = field.programs.find((p) => p.courses.length > 0)!;
      const inUse = 'LEARNING-CATALOG_IN_USE';

      expect(
        remove(trainingCatalogEndpoints.deleteField, field.id, field.rowVersion)
          .body.messageCode,
      ).toBe(inUse);
      expect(
        remove(
          trainingCatalogEndpoints.deleteProgram,
          program.id,
          program.rowVersion,
        ).body.messageCode,
      ).toBe(inUse);
      expect(tree().some((f) => f.id === field.id)).toBe(true);
    });

    it('refuses a stale version and an unknown id', () => {
      const field = emptyField();
      expect(
        remove(trainingCatalogEndpoints.deleteField, field.id, 7).body
          .messageCode,
      ).toBe('LEARNING-CONFLICT');
      expect(
        remove(trainingCatalogEndpoints.deleteProgram, 424242, 0).body
          .messageCode,
      ).toBe('CORE-RESOURCE_NOT_FOUND');
      expect(tree().some((f) => f.id === field.id)).toBe(true);
    });
  });
});
