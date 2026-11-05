import { InjectionToken, type Signal } from '@angular/core';

/** The course a drawer opened from a course screen imports into; the drawer does not ask. */
export interface QuestionImportCourse {
  readonly courseId: number;
  readonly title: string;
}

/**
 * What the "Nhập từ Excel" drawer needs from the screen that opens it: which program's courses it
 * may import into (or the one course it must), and what to do once it is done. The question bank
 * screen and the course editor's exam step each provide one.
 */
export interface QuestionImportHost {
  /** The program whose courses the drawer lists. */
  readonly programId$: Signal<number | undefined>;
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
