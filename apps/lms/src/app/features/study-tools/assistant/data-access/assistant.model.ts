import type { Citation } from '@lms/contracts';

/** Where an answer is in its life; the server's stream drives every step but `stopped`. */
export type AnswerStatus =
  | 'searching'
  | 'composing'
  | 'done'
  | 'stopped'
  | 'error';

/** The assistant's side of one turn. The chat lives in the browser only. */
export interface Answer {
  readonly status: AnswerStatus;
  readonly text: string;
  /** How many passages the server found, once it says so. */
  readonly retrieved: number | null;
  readonly found: boolean | null;
  readonly citations: readonly Citation[];
  /** What went wrong, in Vietnamese, when `status` is `error`. */
  readonly error: string | null;
}

/** One question and the answer to it. */
export interface Turn {
  readonly id: number;
  readonly question: string;
  readonly answer: Answer;
}

/** A file on its way to the knowledge base. */
export interface Upload {
  readonly id: number;
  readonly file: File;
  readonly name: string;
  readonly size: number;
  readonly state: 'waiting' | 'uploading' | 'error';
  readonly error: string | null;
}
