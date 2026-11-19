import { COURSE_LIMITS, type TranscriptLine } from '@lms/contracts';

// A Video Block's Transcript as an author uploads it: a `.txt` file read in the browser. The
// store decodes the file (`decodeTranscriptFile`) and then calls the one parser
// (`parseTranscriptText`); both refuse with the same typed error, worded by
// `transcriptErrorMessage`.

/** The largest file the row accepts. */
export const TRANSCRIPT_MAX_BYTES = 2 * 1024 * 1024;

/** Why a file was refused: the file checks, then the parse. `line` is the 1-based line of the file. */
export type TranscriptError =
  | { readonly code: 'extension' }
  | { readonly code: 'size' }
  | { readonly code: 'unreadable' }
  | { readonly code: 'encoding' }
  | { readonly code: 'empty' }
  | { readonly code: 'untimed' }
  | { readonly code: 'too-long' }
  | { readonly code: 'order'; readonly line: number; readonly time: number }
  | { readonly code: 'duration'; readonly line: number; readonly time: number };

export interface ParsedTranscript {
  readonly lines: readonly TranscriptLine[];
  /** Whether the lines carry their time; every line does, or none does. */
  readonly timed: boolean;
  /** How many lines were merged to fit the line limit. */
  readonly mergedCount: number;
}

/** A parse either goes through or is refused: look for `error` to tell which. */
export type TranscriptParse =
  | ParsedTranscript
  | { readonly error: TranscriptError };

const CLOCK = String.raw`(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.,]\d{1,3})?`;
const RANGE_END = String.raw`(?:\s*-->\s*(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?)?`;
/** `[`/`(`, the start time, an ignored `.mmm` and `--> end`, `]`/`)` and the separators after it. */
const STAMP = new RegExp(
  String.raw`^[\[(]?\s*${CLOCK}(?!\d)${RANGE_END}\s*[\])]?[\s\-:]*`,
);

/** The start time a row begins with, and the row without it; `null` when it begins with no stamp. */
function readStamp(row: string): { seconds: number; text: string } | null {
  const match = STAMP.exec(row);
  if (!match) return null;
  const [stamp, hours, minutes, seconds] = match;
  const [h, m, s] = [Number(hours ?? 0), Number(minutes), Number(seconds)];
  if (s > 59 || (hours !== undefined && m > 59)) return null;
  return { seconds: h * 3600 + m * 60 + s, text: row.slice(stamp.length) };
}

const joinText = (...parts: string[]): string =>
  parts.filter(Boolean).join(' ');

/**
 * Turns the text of a Transcript file into lines. A timed file keeps each line's start time; a
 * line without a stamp joins the timed line before it. `durationSeconds`, when known, bounds the
 * times. The text is already decoded and its line ends are LF.
 */
export function parseTranscriptText(
  text: string,
  durationSeconds?: number,
): TranscriptParse {
  const rows = text.split(/\r\n?|\n/);
  const lead: string[] = [];
  const entries: { start: number; text: string }[] = [];

  for (const [index, raw] of rows.entries()) {
    const row = raw.replace(/\s+/g, ' ').trim();
    if (!row) continue;
    const stamp = readStamp(row);
    const last = entries.at(-1);
    if (!stamp) {
      if (last) last.text = joinText(last.text, row);
      else lead.push(row);
      continue;
    }
    const line = index + 1;
    if (last && stamp.seconds < last.start) {
      return { error: { code: 'order', line, time: stamp.seconds } };
    }
    if (durationSeconds !== undefined && stamp.seconds > durationSeconds) {
      return { error: { code: 'duration', line, time: stamp.seconds } };
    }
    if (last?.start === stamp.seconds) {
      last.text = joinText(last.text, stamp.text.trim());
    } else {
      entries.push({ start: stamp.seconds, text: stamp.text.trim() });
    }
  }

  if (!entries.length) {
    return { error: { code: lead.length ? 'untimed' : 'empty' } };
  }
  entries[0].text = joinText(...lead, entries[0].text);
  const lines = entries
    .filter((entry) => entry.text)
    .map(({ start, text: words }) => ({ startSeconds: start, text: words }));
  if (!lines.length) return { error: { code: 'empty' } };
  if (
    lines.length > COURSE_LIMITS.transcriptLines ||
    lines.some((line) => line.text.length > COURSE_LIMITS.transcriptText)
  ) {
    return { error: { code: 'too-long' } };
  }
  return { lines, timed: true, mergedCount: 0 };
}

// `Promise.withResolvers` is not in the project's TypeScript `lib`, so the executor form stays.
const readBytes = (file: File): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });

/**
 * The text of a Transcript file, after the checks that come before parsing: the `.txt` extension,
 * the size, a strict UTF-8 decode (BOM stripped, CRLF and CR turned into LF) and some content.
 */
export async function decodeTranscriptFile(
  file: File,
): Promise<{ readonly text: string } | { readonly error: TranscriptError }> {
  if (!/\.txt$/i.test(file.name)) return { error: { code: 'extension' } };
  if (file.size > TRANSCRIPT_MAX_BYTES) return { error: { code: 'size' } };
  let bytes: ArrayBuffer;
  try {
    bytes = await readBytes(file);
  } catch {
    return { error: { code: 'unreadable' } };
  }
  let decoded: string;
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return { error: { code: 'encoding' } };
  }
  const text = decoded.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  return text.trim() ? { text } : { error: { code: 'empty' } };
}

const pad = (value: number): string => String(value).padStart(2, '0');

/** `hh:mm:ss`, the form the author's file and the error copy use. */
function clock(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${pad(Math.floor(whole / 3600))}:${pad(Math.floor((whole % 3600) / 60))}:${pad(whole % 60)}`;
}

/** The inline copy under the Transcript row. */
export function transcriptErrorMessage(error: TranscriptError): string {
  switch (error.code) {
    case 'extension':
      return 'Chỉ nhận tệp .txt.';
    case 'size':
      return 'Tệp transcript tối đa 2 MB.';
    case 'unreadable':
      return 'Không đọc được tệp transcript.';
    case 'encoding':
      return 'Tệp phải được lưu với mã hóa UTF-8.';
    case 'empty':
      return 'Tệp transcript không có nội dung.';
    case 'untimed':
      return 'Tệp transcript chưa có mốc thời gian: mỗi dòng cần bắt đầu bằng mốc như 00:01:02.';
    case 'too-long':
      return 'Transcript quá dài: tối đa 2.000 dòng × 1.000 ký tự.';
    case 'order':
      return `Dòng ${error.line}: thời điểm ${clock(error.time)} nhỏ hơn dòng trước.`;
    case 'duration':
      return `Dòng ${error.line}: thời điểm ${clock(error.time)} vượt quá thời lượng video.`;
  }
}
