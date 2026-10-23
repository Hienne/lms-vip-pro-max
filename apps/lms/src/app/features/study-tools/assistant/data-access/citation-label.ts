import type { Citation } from '@lms/contracts';

/**
 * Where a citation points: a PDF has pages and lines, a Markdown file has lines, a Word file has
 * paragraphs (the backend counts each paragraph or table row as one line). The file type is read
 * from the extension.
 */
export function citationLocation(citation: Citation): string {
  const { page, lineStart, lineEnd, fileName } = citation;
  const range =
    lineStart === lineEnd ? `${lineStart}` : `${lineStart}–${lineEnd}`;
  if (page !== null) return `trang ${page} · dòng ${range}`;
  return /\.docx$/i.test(fileName) ? `đoạn ${range}` : `dòng ${range}`;
}

/** `[1] Quy-trinh-EOD.pdf · trang 3 · dòng 13–27` */
export function citationLabel(citation: Citation): string {
  return `[${citation.n}] ${citation.fileName} · ${citationLocation(citation)}`;
}
