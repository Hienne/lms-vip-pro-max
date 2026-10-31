import { BlockReasonSchema } from '@lms/contracts';
import { blockReasonText } from './quiz-block-reason';

describe('blockReasonText', () => {
  const at = '2026-11-02T08:30:00';

  it('words every code the server can send, each differently', () => {
    const lines = BlockReasonSchema.options.map((reason) =>
      blockReasonText(reason, { availableAt: at, closeAt: at }),
    );
    expect(new Set(lines).size).toBe(BlockReasonSchema.options.length);
    expect(lines.every((line) => line.endsWith('.'))).toBe(true);
  });

  it('puts the time the server gave into the opening and retake lines', () => {
    expect(blockReasonText('NOT_OPEN', { availableAt: at })).toContain(
      '02/11/2026',
    );
    expect(blockReasonText('WAIT', { availableAt: at })).toContain(
      '02/11/2026',
    );
    expect(blockReasonText('CLOSED', { closeAt: at })).toContain('02/11/2026');
  });

  it('still reads as a sentence when the server sent no time', () => {
    expect(blockReasonText('NOT_OPEN')).toBe('Bài kiểm tra chưa mở.');
    expect(blockReasonText('WAIT')).toBe('Bạn cần chờ thêm trước khi thi lại.');
    expect(blockReasonText('CLOSED')).toBe('Bài kiểm tra đã đóng.');
  });
});
