import type { Citation } from '@lms/contracts';
import { citationLocation, citationName } from './citation-label';

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

describe('citationName', () => {
  it('reads the number, the file and the location as one phrase', () => {
    expect(
      citationName(citation({ n: 2, page: 3, lineStart: 13, lineEnd: 27 })),
    ).toBe('Nguồn 2: quy-trinh.pdf, trang 3, dòng 13–27');
    expect(citationName(citation({ fileName: 'b.docx' }))).toBe(
      'Nguồn 1: b.docx, đoạn 3',
    );
  });
});
