import { completionHint } from './completion-hint';

describe('completionHint', () => {
  it('explains when a manual block is saved as complete', () => {
    expect(completionHint('manual', 0, null)).toBe(
      'Tiến độ sẽ được ghi khi bạn chuyển tiếp',
    );
  });

  it("repeats the server's watched share and threshold for a video", () => {
    expect(completionHint('video_coverage', 35, 80)).toBe(
      'Đã xem 35% · cần 80%',
    );
    expect(completionHint('video_coverage', 35, null)).toBe('Đã xem 35%');
  });

  it('asks to reach the last page of a PDF', () => {
    expect(completionHint('pdf_end', 0, null)).toBe(
      'Xem đến trang cuối để hoàn thành',
    );
  });

  it('says nothing for a block that completes on open', () => {
    expect(completionHint('open', 100, null)).toBeNull();
  });
});
