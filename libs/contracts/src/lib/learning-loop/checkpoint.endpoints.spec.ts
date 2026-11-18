import { toUrl } from '../http/endpoint';
import { capturedCheckpoint as captured } from './checkpoint.captured';
import { checkpointEndpoints as e } from './checkpoint.endpoints';
import {
  CheckpointAnswerBodySchema,
  CheckpointSchema,
} from './checkpoint.schema';

describe('checkpointEndpoints', () => {
  it.each([
    ['checkpoint', captured.checkpoint],
    ['checkpoint', captured.emptyCheckpoint],
    ['answerCheckpoint', captured.answerWrong],
    ['answerCheckpoint', captured.answerRight],
  ] as const)('parses the %s response example', (key, data) => {
    expect(e[key].response.safeParse(data).success).toBe(true);
  });

  it('keeps the answer key out of the question payload', () => {
    const view = CheckpointSchema.parse(captured.checkpoint);
    expect(JSON.stringify(view)).not.toMatch(/correct|explanation/);
  });

  it('refuses more than three questions', () => {
    const question = captured.checkpoint.questions[0];
    const four = {
      lessonId: 1,
      questions: [question, question, question, question],
    };
    expect(CheckpointSchema.safeParse(four).success).toBe(false);
  });

  it('refuses an answer without a chosen option', () => {
    const body = { questionId: 1, questionVersion: 0, optionIds: [] };
    expect(CheckpointAnswerBodySchema.safeParse(body).success).toBe(false);
  });

  it('builds the lesson URLs', () => {
    expect(toUrl(e.checkpoint, { lessonId: 41 })).toBe(
      '/api/v1/me/lessons/41/checkpoint',
    );
    expect(toUrl(e.answerCheckpoint, { lessonId: 41 })).toBe(
      '/api/v1/me/lessons/41/checkpoint/answers',
    );
  });
});
