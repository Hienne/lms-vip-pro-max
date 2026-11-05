import { InjectionToken, type Signal } from '@angular/core';

/** The course editor's source course, passed for authorization; questions belong to its program. */
export interface QuestionImportCourse {
  readonly courseId: number;
  readonly title: string;
}

/**
 * What the "Nhập từ Excel" drawer needs from the screen that opens it: the program receiving
 * questions, an optional source course for authorization, and what to do once it is done. The question bank
 * screen and the course editor's exam step each provide one.
 */
export interface QuestionImportHost {
  /** The bank receiving the imported questions. */
  readonly programId$: Signal<number | undefined>;
  readonly programName$: Signal<string | undefined>;
  /** Set when the screen already knows the course: the drawer shows its name and asks nothing. */
  readonly fixedCourse$?: Signal<QuestionImportCourse | undefined>;
  /** A written import: the screen closes the drawer and reads its questions again. */
  finishImport(): void;
  /** Dismissed without importing. */
  closeImport(): void;
}

export const QUESTION_IMPORT_HOST = new InjectionToken<QuestionImportHost>(
  'QUESTION_IMPORT_HOST',
);
