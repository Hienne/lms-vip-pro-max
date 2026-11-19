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

const SENTENCE_END = /(?<=[.!?…])\s+/;

/**
 * `text` cut into pieces of at most `max` characters at word boundaries. A word longer than `max`
 * is cut where the limit falls (not inside a surrogate pair), so no file is refused for it.
 */
function splitWords(text: string, max: number): string[] {
  const pieces: string[] = [];
  let piece = '';
  for (let word of text.split(' ')) {
    while (word.length > max) {
      if (piece) pieces.push(piece);
      piece = '';
      const high = word.charCodeAt(max - 1);
      const cut = high >= 0xd800 && high <= 0xdbff ? max - 1 : max;
      pieces.push(word.slice(0, cut));
      word = word.slice(cut);
    }
    if (!word) continue;
    if (!piece) piece = word;
    else if (piece.length + 1 + word.length <= max) piece += ` ${word}`;
    else {
      pieces.push(piece);
      piece = word;
    }
  }
  if (piece) pieces.push(piece);
  return pieces;
}

/** The sentences of one paragraph packed into lines of at most `max` characters. */
function packSentences(paragraph: string, max: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const sentence of paragraph.split(SENTENCE_END)) {
    if (sentence.length > max) {
      if (line) lines.push(line);
      const pieces = splitWords(sentence, max);
      line = pieces.pop() ?? '';
      lines.push(...pieces);
    } else if (!line) {
      line = sentence;
    } else if (line.length + 1 + sentence.length <= max) {
      line += ` ${sentence}`;
    } else {
      lines.push(line);
      line = sentence;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * A file with no timestamp: its paragraphs (blocks of rows between blank rows), each packed into
 * lines by sentence. Every line has no time.
 */
function untimedLines(rows: readonly string[]): TranscriptParse {
  const paragraphs: string[][] = [[]];
  for (const raw of rows) {
    const row = raw.replace(/\s+/g, ' ').trim();
    if (row) paragraphs[paragraphs.length - 1].push(row);
    else if (paragraphs[paragraphs.length - 1].length) paragraphs.push([]);
  }
  const lines = paragraphs
    .filter((paragraph) => paragraph.length)
    .flatMap((paragraph) =>
      packSentences(paragraph.join(' '), COURSE_LIMITS.transcriptText),
    )
    .map((text) => ({ startSeconds: null, text }));
  if (lines.length > COURSE_LIMITS.transcriptLines) {
    return { error: { code: 'too-long' } };
  }
  return { lines, timed: false, mergedCount: 0 };
}

const MS = 1000;

/**
 * Each line over `max` characters cut into pieces by sentence, then by word. A piece after the
 * first starts 0.001 s after the one before it, so times stay strictly increasing. Those times
 * must stay below the next line's start and, when the video length is known, within it. When a
 * gap is too small for them, no piece is nudged onto a neighbour: the file does not fit (`null`).
 */
function splitLongLines(
  lines: readonly TranscriptLine[],
  max: number,
  durationSeconds: number | undefined,
): TranscriptLine[] | null {
  const out: TranscriptLine[] = [];
  for (const [index, line] of lines.entries()) {
    if (line.text.length <= max) {
      out.push(line);
      continue;
    }
    const firstMs = Math.round((line.startSeconds as number) * MS);
    const pieces = packSentences(line.text, max);
    const lastMs = firstMs + pieces.length - 1;
    const next = lines[index + 1]?.startSeconds;
    if (
      (next != null && lastMs >= Math.round(next * MS)) ||
      (durationSeconds !== undefined &&
        lastMs > Math.round(durationSeconds * MS))
    ) {
      return null;
    }
    for (const [k, text] of pieces.entries()) {
      out.push({ startSeconds: (firstMs + k) / MS, text });
    }
  }
  return out;
}

/**
 * Adjacent lines merged pairwise (the earlier time, the texts joined, at most `maxText`
 * characters) in passes until at most `maxLines` remain; the last pass stops as soon as the count
 * is reached. `null` when a pass can merge nothing and there are still too many lines.
 */
function mergePairs(
  lines: readonly TranscriptLine[],
  maxLines: number,
  maxText: number,
): TranscriptLine[] | null {
  let current = [...lines];
  while (current.length > maxLines) {
    let excess = current.length - maxLines;
    const next: TranscriptLine[] = [];
    for (let i = 0; i < current.length; i += 1) {
      const a = current[i];
      const b = current[i + 1];
      if (excess > 0 && b && a.text.length + 1 + b.text.length <= maxText) {
        next.push({
          startSeconds: a.startSeconds,
          text: `${a.text} ${b.text}`,
        });
        excess -= 1;
        i += 1;
      } else {
        next.push(a);
      }
    }
    if (next.length === current.length) return null;
    current = next;
  }
  return current;
}

/** Timed lines fitted to the limits: long lines split, then adjacent lines merged. */
function fitTimedLines(
  lines: readonly TranscriptLine[],
  durationSeconds: number | undefined,
): TranscriptParse {
  const split = splitLongLines(
    lines,
    COURSE_LIMITS.transcriptText,
    durationSeconds,
  );
  const merged =
    split &&
    mergePairs(
      split,
      COURSE_LIMITS.transcriptLines,
      COURSE_LIMITS.transcriptText,
    );
  if (!split || !merged) return { error: { code: 'too-long' } };
  return {
    lines: merged,
    timed: true,
    mergedCount: split.length - merged.length,
  };
}

/**
 * Turns the text of a Transcript file into lines. A timed file keeps each line's start time; a
 * line without a stamp joins the timed line before it. A file with no timestamp is untimed: its
 * paragraphs are packed into lines by sentence, each with a null time. `durationSeconds`, when
 * known, bounds the times of a timed file. The text is already decoded and its line ends are LF.
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
    return lead.length ? untimedLines(rows) : { error: { code: 'empty' } };
  }
  entries[0].text = joinText(...lead, entries[0].text);
  const lines = entries
    .filter((entry) => entry.text)
    .map(({ start, text: words }) => ({ startSeconds: start, text: words }));
  if (!lines.length) return { error: { code: 'empty' } };
  return fitTimedLines(lines, durationSeconds);
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
    case 'too-long':
      return 'Transcript quá dài: tối đa 2.000 dòng × 1.000 ký tự.';
    case 'order':
      return `Dòng ${error.line}: thời điểm ${clock(error.time)} nhỏ hơn dòng trước.`;
    case 'duration':
      return `Dòng ${error.line}: thời điểm ${clock(error.time)} vượt quá thời lượng video.`;
  }
}
