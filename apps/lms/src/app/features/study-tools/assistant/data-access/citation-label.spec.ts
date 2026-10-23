import type { Citation } from '@lms/contracts';
import { citationLabel, citationLocation } from './citation-label';

const citation = (over: Partial<Citation>): Citation => ({
  n: 1,
  documentId: 1,
  fileName: 'quy-trinh.pdf',
  page: null,
  lineStart: 3,
  lineEnd: 3,
  snippet: '',
  ...over,
});

describe('citationLocation', () => {
  it('names the page and the lines for a PDF', () => {
    expect(
      citationLocation(citation({ page: 3, lineStart: 13, lineEnd: 27 })),
    ).toBe('trang 3 · dòng 13–27');
  });

  it('names lines for a Markdown file and a single line without a range', () => {
    expect(citationLocation(citation({ fileName: 'a.md' }))).toBe('dòng 3');
    expect(
      citationLocation(
        citation({ fileName: 'a.md', lineStart: 2, lineEnd: 9 }),
      ),
    ).toBe('dòng 2–9');
  });

  it('names paragraphs for a Word file', () => {
    expect(
      citationLocation(
        citation({ fileName: 'a.DOCX', lineStart: 4, lineEnd: 6 }),
      ),
    ).toBe('đoạn 4–6');
  });
});

describe('citationLabel', () => {
  it('puts the number, the file and the location together', () => {
    expect(
      citationLabel(citation({ n: 2, page: 1, lineStart: 5, lineEnd: 8 })),
    ).toBe('[2] quy-trinh.pdf · trang 1 · dòng 5–8');
  });
});
