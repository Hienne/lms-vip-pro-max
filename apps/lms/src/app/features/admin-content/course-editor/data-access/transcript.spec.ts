import {
  decodeTranscriptFile,
  parseTranscriptText,
  transcriptErrorMessage,
  type TranscriptError,
  type TranscriptParse,
} from './transcript';

/** The error of a refused parse; fails the test when the parse went through. */
const errorOf = (result: TranscriptParse): TranscriptError => {
  if (!('error' in result)) throw new Error('expected a refusal');
  return result.error;
};

/** The lines of an accepted parse; fails the test when it was refused. */
const linesOf = (result: TranscriptParse) => {
  if ('error' in result) throw new Error(transcriptErrorMessage(result.error));
  return result.lines;
};

const TEAMS = [
  '[00:00:05] Giảng viên: Xin chào các bạn, hôm nay chúng ta học về hạch toán.',
  '[00:01:02] Giảng viên: Trước hết là khái niệm tài khoản.',
  '[00:01:30] Học viên: Thưa thầy, tài khoản chi tiết khác gì tài khoản tổng hợp?',
  '[00:02:15] Giảng viên: Câu hỏi hay.',
].join('\n');

describe('parseTranscriptText', () => {
  describe('timestamps', () => {
    it('reads a Teams-style export with bracketed hh:mm:ss and keeps speaker labels', () => {
      const result = parseTranscriptText(TEAMS);

      expect(result).toEqual({
        timed: true,
        mergedCount: 0,
        lines: [
          {
            startSeconds: 5,
            text: 'Giảng viên: Xin chào các bạn, hôm nay chúng ta học về hạch toán.',
          },
          {
            startSeconds: 62,
            text: 'Giảng viên: Trước hết là khái niệm tài khoản.',
          },
          {
            startSeconds: 90,
            text: 'Học viên: Thưa thầy, tài khoản chi tiết khác gì tài khoản tổng hợp?',
          },
          { startSeconds: 135, text: 'Giảng viên: Câu hỏi hay.' },
        ],
      });
    });

    it.each([
      ['hh:mm:ss', '01:02:03 Nội dung', 3723],
      ['h:mm:ss', '1:02:03 Nội dung', 3723],
      ['mm:ss', '02:03 Nội dung', 123],
      ['m:ss', '2:03 Nội dung', 123],
      ['[hh:mm:ss]', '[01:02:03] Nội dung', 3723],
      ['(mm:ss)', '(02:03) Nội dung', 123],
      ['a dash separator', '02:03 - Nội dung', 123],
      ['a colon separator', '02:03: Nội dung', 123],
      ['.mmm', '00:02:03.456 Nội dung', 123],
      [',mmm', '00:02:03,456 Nội dung', 123],
      ['an a --> b range', '00:02:03,000 --> 00:02:09,500 Nội dung', 123],
      ['a bracketed range', '[02:03 --> 02:09] Nội dung', 123],
    ])('accepts %s', (_, line, seconds) => {
      expect(linesOf(parseTranscriptText(line))).toEqual([
        { startSeconds: seconds, text: 'Nội dung' },
      ]);
    });

    it('does not take a number that is not a clock time for a stamp', () => {
      const result = parseTranscriptText(
        '00:05 Mở đầu\nTỷ lệ 12:99 không phải mốc\n75:30 mốc dài',
      );

      expect(linesOf(result)).toEqual([
        { startSeconds: 5, text: 'Mở đầu Tỷ lệ 12:99 không phải mốc' },
        { startSeconds: 4530, text: 'mốc dài' },
      ]);
    });

    it('collapses whitespace inside a line', () => {
      expect(
        linesOf(parseTranscriptText('00:05   Một \t  hai\u00a0 ba   ')),
      ).toEqual([{ startSeconds: 5, text: 'Một hai ba' }]);
    });
  });

  describe('lines without a stamp', () => {
    it('joins them into the timed line before them', () => {
      const result = parseTranscriptText(
        '00:05 Câu này dài\nnên xuống dòng\n\nvà cách một dòng trống\n00:20 Câu sau',
      );

      expect(linesOf(result)).toEqual([
        {
          startSeconds: 5,
          text: 'Câu này dài nên xuống dòng và cách một dòng trống',
        },
        { startSeconds: 20, text: 'Câu sau' },
      ]);
    });

    it('joins text before the first stamp into the first timed line', () => {
      const result = parseTranscriptText(
        'Buổi học Core Banking\nNgày 19/11\n00:05 Xin chào\n00:10 Tiếp',
      );

      expect(linesOf(result)).toEqual([
        {
          startSeconds: 5,
          text: 'Buổi học Core Banking Ngày 19/11 Xin chào',
        },
        { startSeconds: 10, text: 'Tiếp' },
      ]);
    });

    it('gives a stamp-only line the text that follows it, as a subtitle block does', () => {
      const result = parseTranscriptText(
        '00:00:01,000 --> 00:00:03,000\nXin chào\n00:00:03,500 --> 00:00:05,000\nCác bạn',
      );

      expect(linesOf(result)).toEqual([
        { startSeconds: 1, text: 'Xin chào' },
        { startSeconds: 3, text: 'Các bạn' },
      ]);
    });
  });

  it('merges consecutive lines of equal time', () => {
    const result = parseTranscriptText(
      '00:05 Một\n00:05 Hai\n00:09 Ba\n00:09 Bốn',
    );

    expect(linesOf(result)).toEqual([
      { startSeconds: 5, text: 'Một Hai' },
      { startSeconds: 9, text: 'Ba Bốn' },
    ]);
  });

  describe('refusals', () => {
    it('fails on a time that goes back, with its line number and time', () => {
      const text = [
        ...Array.from({ length: 3 }, (_, i) => `00:0${i + 1}:00 Dòng ${i + 1}`),
        'Lời nối tiếp',
        '00:00:30 Quay ngược',
      ].join('\n');

      const error = errorOf(parseTranscriptText(text));

      expect(error).toEqual({ code: 'order', line: 5, time: 30 });
      expect(transcriptErrorMessage(error)).toBe(
        'Dòng 5: thời điểm 00:00:30 nhỏ hơn dòng trước.',
      );
    });

    it('fails on a time past the video length when it is known', () => {
      const text = '00:00:05 Một\n00:12:03 Hai\n00:20:00 Ba';

      const error = errorOf(parseTranscriptText(text, 900));

      expect(error).toEqual({ code: 'duration', line: 3, time: 1200 });
      expect(transcriptErrorMessage(error)).toBe(
        'Dòng 3: thời điểm 00:20:00 vượt quá thời lượng video.',
      );
    });

    it('accepts a time at the end of the video, and any time when the length is unknown', () => {
      expect(parseTranscriptText('00:15:00 Hết', 900)).toMatchObject({
        timed: true,
      });
      expect(parseTranscriptText('99:59 Rất xa')).toMatchObject({
        timed: true,
      });
    });

    it('refuses a file with no timestamp, for now', () => {
      const error = errorOf(
        parseTranscriptText('Một đoạn văn bản thường.\n\nĐoạn thứ hai.'),
      );

      expect(error).toEqual({ code: 'untimed' });
      expect(transcriptErrorMessage(error)).toMatch(/mốc thời gian/);
    });

    it('refuses a file of stamps with no words', () => {
      expect(errorOf(parseTranscriptText('00:05\n00:09'))).toEqual({
        code: 'empty',
      });
    });

    it('refuses more than 2,000 lines, and a line over 1,000 characters', () => {
      const many = Array.from(
        { length: 2001 },
        (_, i) =>
          `${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')} Dòng ${i}`,
      ).join('\n');
      const long = `00:05 ${'a'.repeat(1001)}`;

      for (const text of [many, long]) {
        const error = errorOf(parseTranscriptText(text));
        expect(error).toEqual({ code: 'too-long' });
        expect(transcriptErrorMessage(error)).toBe(
          'Transcript quá dài: tối đa 2.000 dòng × 1.000 ký tự.',
        );
      }
    });

    it('accepts exactly 2,000 lines of 1,000 characters', () => {
      const text = Array.from(
        { length: 2000 },
        (_, i) =>
          `${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')} ${'b'.repeat(994)}`,
      ).join('\n');

      const result = parseTranscriptText(text);

      expect(linesOf(result)).toHaveLength(2000);
    });
  });

  it('reads CRLF line endings and a stray CR', () => {
    expect(
      linesOf(parseTranscriptText('00:05 Một\r\nhai\r00:09 Ba\r\n')),
    ).toEqual([
      { startSeconds: 5, text: 'Một hai' },
      { startSeconds: 9, text: 'Ba' },
    ]);
  });
});

describe('decodeTranscriptFile', () => {
  const file = (content: BlobPart, name = 'bai-1.txt') =>
    new File([content], name, { type: 'text/plain' });
  const bytes = (...values: number[]) => new Uint8Array(values);

  it('decodes UTF-8, strips the BOM and turns CRLF and CR into LF', async () => {
    const encoded = new TextEncoder().encode(
      '\uFEFF[00:05] Chào\r\nbạn\r[00:09] Hết',
    );

    expect(await decodeTranscriptFile(file(encoded))).toEqual({
      text: '[00:05] Chào\nbạn\n[00:09] Hết',
    });
  });

  it('refuses a file that is not .txt', async () => {
    expect(await decodeTranscriptFile(file('x', 'bai.srt'))).toEqual({
      error: { code: 'extension' },
    });
    expect(await decodeTranscriptFile(file('x', 'bai.TXT'))).toHaveProperty(
      'text',
    );
  });

  it('refuses a file over 2 MB without reading it', async () => {
    const big = file(new Uint8Array(2 * 1024 * 1024 + 1));
    const read = vi.spyOn(FileReader.prototype, 'readAsArrayBuffer');

    expect(await decodeTranscriptFile(big)).toEqual({
      error: { code: 'size' },
    });
    expect(read).not.toHaveBeenCalled();
  });

  it('accepts a file of exactly 2 MB', async () => {
    const edge = file(new Uint8Array(2 * 1024 * 1024).fill(0x61));

    expect(await decodeTranscriptFile(edge)).toHaveProperty('text');
  });

  it('refuses bytes that are not UTF-8', async () => {
    // "Giảng viên" saved as Windows-1258 has lone high bytes.
    const legacy = file(bytes(0x47, 0x69, 0xe1, 0x6e, 0x67, 0xff));

    expect(await decodeTranscriptFile(legacy)).toEqual({
      error: { code: 'encoding' },
    });
  });

  it('refuses a file that is empty after trimming', async () => {
    for (const content of ['', '\uFEFF', ' \r\n\t \n']) {
      expect(await decodeTranscriptFile(file(content))).toEqual({
        error: { code: 'empty' },
      });
    }
  });

  it('words each refusal as the spec does', () => {
    expect(transcriptErrorMessage({ code: 'extension' })).toBe(
      'Chỉ nhận tệp .txt.',
    );
    expect(transcriptErrorMessage({ code: 'size' })).toBe(
      'Tệp transcript tối đa 2 MB.',
    );
    expect(transcriptErrorMessage({ code: 'encoding' })).toBe(
      'Tệp phải được lưu với mã hóa UTF-8.',
    );
    expect(transcriptErrorMessage({ code: 'empty' })).toBe(
      'Tệp transcript không có nội dung.',
    );
  });
});
