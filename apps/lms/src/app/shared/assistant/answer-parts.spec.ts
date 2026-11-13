import type { Citation } from '@lms/contracts';
import { answerParts } from './answer-parts';

const citation = (n: number): Citation => ({
  n,
  documentId: n,
  fileName: `tai-lieu-${n}.pdf`,
  page: 1,
  lineStart: 1,
  lineEnd: 2,
  snippet: `Đoạn ${n}`,
});

const shape = (text: string, citations: Citation[]) => {
  const { parts, unmarked } = answerParts(text, citations);
  return {
    parts: parts.map((p) => (p.kind === 'text' ? p.text : p.citation.n)),
    unmarked: unmarked.map((c) => c.n),
  };
};

describe('answerParts', () => {
  it('splits the text at each marker that has a citation', () => {
    expect(
      shape('Đối chiếu [1]. Ghi lại [2].', [citation(1), citation(2)]),
    ).toEqual({
      parts: ['Đối chiếu ', 1, '. Ghi lại ', 2, '.'],
      unmarked: [],
    });
  });

  it('keeps the number the model saw, so a gap in the numbering is fine', () => {
    expect(shape('Xem [3].', [citation(3)])).toEqual({
      parts: ['Xem ', 3, '.'],
      unmarked: [],
    });
  });

  it('opens a group marker into one source per number', () => {
    expect(shape('Xem [1, 2].', [citation(1), citation(2)]).parts).toEqual([
      'Xem ',
      1,
      2,
      '.',
    ]);
  });

  it('drops a number with no citation, so no marker opens nothing', () => {
    expect(shape('A [1] B [9] C [1, 9]', [citation(1)])).toEqual({
      parts: ['A ', 1, ' B C ', 1],
      unmarked: [],
    });
  });

  it('drops the literal placeholder the model copied from its instructions', () => {
    expect(shape('Xem [n]. Ý khác [N]', [])).toEqual({
      parts: ['Xem. Ý khác'],
      unmarked: [],
    });
  });

  it('returns every citation as unmarked when the text marks none', () => {
    expect(shape('Không có số nào.', [citation(1), citation(2)])).toEqual({
      parts: ['Không có số nào.'],
      unmarked: [1, 2],
    });
  });

  it('keeps one citation per number', () => {
    expect(
      shape('Xem [1].', [citation(1), { ...citation(1), snippet: 'lặp' }]),
    ).toEqual({
      parts: ['Xem ', 1, '.'],
      unmarked: [],
    });
  });

  it('treats markup in the text as text', () => {
    expect(shape('<b>đậm</b> [1]', [citation(1)]).parts).toEqual([
      '<b>đậm</b> ',
      1,
    ]);
  });
});
