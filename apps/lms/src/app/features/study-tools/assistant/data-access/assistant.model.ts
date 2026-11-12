import type {
  Citation,
  DocumentScope,
  Feedback,
  StoredActionStatus,
} from '@lms/contracts';

/** Where an answer is in its life; the server's stream drives every step but `stopped`. */
export type AnswerStatus =
  | 'searching'
  | 'composing'
  | 'done'
  | 'stopped'
  | 'error';

/** A change the quick assistant proposed in a reopened turn, read-only here: its title and where it ended. */
export interface AnswerAction {
  readonly title: string;
  readonly status: StoredActionStatus;
  readonly message: string | null;
}

/** The assistant's side of one turn; the turns are the server's saved conversation. */
export interface Answer {
  readonly status: AnswerStatus;
  readonly text: string;
  /** How many passages the server found, once it says so. */
  readonly retrieved: number | null;
  readonly found: boolean | null;
  readonly citations: readonly Citation[];
  /** False: the answer used documents and marks no source, so the page labels it. Absent means true. */
  readonly grounded?: boolean;
  /** What went wrong, in Vietnamese, when `status` is `error`. */
  readonly error: string | null;
  /** Only on a reopened turn that proposed a change in the quick assistant. */
  readonly action?: AnswerAction | null;
}

/** One question and the answer to it. */
export interface Turn {
  readonly id: number;
  readonly question: string;
  readonly answer: Answer;
  /** The turn as the server stored it, once it has: the id feedback is sent against. */
  readonly serverTurnId?: number;
  /** The user's thumbs on the answer, as the server saved them. */
  readonly feedback?: Feedback | null;
  /** Follow-up questions the server offered with this answer. */
  readonly suggestions?: readonly string[];
}

/** A file on its way to the knowledge base. */
export interface Upload {
  readonly id: number;
  readonly file: File;
  readonly name: string;
  readonly size: number;
  /** Who may find the document, chosen before the file was added. */
  readonly scope: DocumentScope;
  readonly state: 'waiting' | 'uploading' | 'error';
  readonly error: string | null;
}
