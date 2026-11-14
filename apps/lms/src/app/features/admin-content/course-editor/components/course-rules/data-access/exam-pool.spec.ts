import { firstValueFrom, of, throwError } from 'rxjs';
import { programAssessmentEndpoints } from '@lms/contracts';
import type { EndpointClient } from '../../../../../../core/http/endpoint-client';
import { activeBankQuestions } from './exam-pool';

const question = (id: number) => ({
  id,
  code: `Q-${id}`,
  contentPreview: `Câu ${id}`,
  questionType: 'SINGLE' as const,
  difficulty: 'EASY' as const,
});

describe('complete program question bank', () => {
  function catalog(total: number) {
    const call = vi.fn(
      (
        _endpoint: unknown,
        { query }: { query: { page: number; size: number } },
      ) => {
        const start = query.page * query.size;
        return of({
          items: Array.from(
            { length: Math.min(query.size, Math.max(0, total - start)) },
            (_, i) => question(start + i + 1),
          ),
          page: query.page,
          size: query.size,
          totalPages: Math.ceil(total / query.size),
          totalElements: total,
        });
      },
    );
    return { call, client: { call } as unknown as EndpointClient };
  }

  it('reads every page beyond 2,000 questions, preserving the program and authorization scope', async () => {
    const { client, call } = catalog(2107);
    const questions = await firstValueFrom(
      activeBankQuestions(client, { programId: 7, courseId: 11 }),
    );
    expect(questions).toHaveLength(2107);
    expect(questions.at(-1)?.id).toBe(2107);
    expect(call).toHaveBeenCalledTimes(22);
    call.mock.calls.forEach(([endpoint, { query }], page) => {
      expect(endpoint).toBe(programAssessmentEndpoints.questions);
      expect(query).toEqual({
        programId: 7,
        courseId: 11,
        status: 'ACTIVE',
        page,
        size: 100,
        sort: 'id,desc',
      });
    });
  });

  it('does not return a partial list when a later page fails', async () => {
    const { client, call } = catalog(250);
    const original = call.getMockImplementation()!;
    call.mockImplementation((endpoint, input) =>
      input.query.page === 1
        ? throwError(() => new Error('offline'))
        : original(endpoint, input),
    );
    await expect(
      firstValueFrom(activeBankQuestions(client, { programId: 7 })),
    ).rejects.toThrow('offline');
    expect(call).toHaveBeenCalledTimes(2);
  });

  it('refuses incomplete or changing catalogues instead of reporting that all questions loaded', async () => {
    const { client, call } = catalog(10);
    call.mockReturnValue(
      of({
        items: [question(1)],
        page: 0,
        size: 100,
        totalPages: 1,
        totalElements: 10,
      }),
    );
    await expect(
      firstValueFrom(activeBankQuestions(client, { programId: 7 })),
    ).rejects.toThrow('complete bank');
  });

  it('reads an empty bank once', async () => {
    const { client, call } = catalog(0);
    expect(
      await firstValueFrom(activeBankQuestions(client, { programId: 7 })),
    ).toEqual([]);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('stops if the server repeats a page instead of issuing an unbounded request loop', async () => {
    const { client, call } = catalog(250);
    const original = call.getMockImplementation()!;
    call.mockImplementation((endpoint, input) =>
      original(endpoint, { query: { ...input.query, page: 0 } }),
    );
    await expect(
      firstValueFrom(activeBankQuestions(client, { programId: 7 })),
    ).rejects.toThrow('unexpected page');
    expect(call).toHaveBeenCalledTimes(2);
  });
});
