import { Injectable } from '@angular/core';
import type { CourseFormPrefill } from '@lms/contracts';

/** What the chat hands to the new-course form: the file the user attached and what they said. */
export interface CoursePrefill {
  /** The attached source file, kept here and not uploaded until "Tạo bằng AI" is pressed. */
  readonly file: File | null;
  readonly fields: CourseFormPrefill;
}

/**
 * The hand-over from the chat to step 1 of the course form (`open_course_form`). The chat puts a
 * prefill here just before it follows the server's navigation; the form reads it once when it
 * opens and it is gone. It lives in memory only, so a reload before the form loses it, and
 * opening the form any other way finds nothing.
 */
@Injectable({ providedIn: 'root' })
export class CourseFormPrefillStore {
  private pending: CoursePrefill | null = null;

  set(prefill: CoursePrefill): void {
    this.pending = prefill;
  }

  /** The waiting prefill, which is cleared by this read; null when there is none. */
  take(): CoursePrefill | null {
    const prefill = this.pending;
    this.pending = null;
    return prefill;
  }

  clear(): void {
    this.pending = null;
  }
}
