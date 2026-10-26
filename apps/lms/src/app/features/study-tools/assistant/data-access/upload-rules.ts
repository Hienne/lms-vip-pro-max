/** What the backend accepts (`app.knowledge.max-file-size`, its supported types), checked early. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const ACCEPTED = /\.(pdf|md|docx)$/i;

export const UPLOAD_ACCEPT = '.pdf,.md,.docx';

/** The reason a file cannot be uploaded, in the backend's words, or `null` when it can. */
export function uploadProblem(file: File): string | null {
  if (!ACCEPTED.test(file.name)) return 'Chỉ hỗ trợ tệp .pdf, .md hoặc .docx.';
  if (file.size === 0) {
    return 'Tệp rỗng, bị hỏng hoặc nội dung không khớp với loại tệp.';
  }
  if (file.size > MAX_UPLOAD_BYTES)
    return 'Tệp vượt quá dung lượng tối đa 20 MB.';
  return null;
}
