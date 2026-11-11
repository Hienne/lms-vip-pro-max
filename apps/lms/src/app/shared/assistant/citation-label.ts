import type { Citation } from '@lms/contracts';

/**
 * Where a citation points, part by part: a PDF has pages and lines, a Markdown file has lines, a
 * Word file has paragraphs (the backend counts each paragraph or table row as one line). The file
 * type is read from the extension.
 */
function locationParts(citation: Citation): string[] {
  // A lesson has no pages: it is placed by its chapter and lesson.
  if (citation.lesson) {
    return [citation.lesson.chapterTitle, citation.lesson.lessonTitle];
  }
  const { page, lineStart, lineEnd, fileName } = citation;
  const range =
    lineStart === lineEnd ? `${lineStart}` : `${lineStart}–${lineEnd}`;
  if (page !== null) return [`trang ${page}`, `dòng ${range}`];
  return [/\.docx$/i.test(fileName) ? `đoạn ${range}` : `dòng ${range}`];
}

/** `trang 3 · dòng 13–27`, or `Chương 1 · Lãi suất` for a lesson */
export function citationLocation(citation: Citation): string {
  return locationParts(citation).join(' · ');
}

/** What a screen reader hears for a source badge: `Nguồn 1: Quy-trinh-EOD.pdf, trang 3, dòng 13–27` */
export function citationName(citation: Citation): string {
  return `Nguồn ${citation.n}: ${[citation.fileName, ...locationParts(citation)].join(', ')}`;
}
