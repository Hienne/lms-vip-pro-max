import { computed, inject, Injectable } from '@angular/core';
import { CourseJobTrackerStore } from '../course-jobs/course-job-tracker.store';
import {
  DocumentTrackerStore,
  type OwlState,
} from '../knowledge/document-tracker.store';

export type BackgroundKind = 'document' | 'course';

/** What the owl's bubble says about the last background job that stopped. */
export interface BackgroundNotice {
  readonly kind: BackgroundKind;
  /** The file the work was about. */
  readonly fileName: string;
  readonly ok: boolean;
  /** Where "open" goes: the course review screen, or the assistant for a document. */
  readonly href: string;
  /** The words of the link: what the user does next. */
  readonly action: string;
  readonly at: number;
}

/**
 * The owl's one view of everything the app is waiting for in the background. Each kind of work is
 * a source with its own tracker (documents being read, course generations being written); this
 * store only combines them into the owl's state, its label and its latest notice, so a new kind
 * of background job is one more source here and nothing in the owl changes.
 */
@Injectable({ providedIn: 'root' })
export class BackgroundJobsStore {
  private readonly documents = inject(DocumentTrackerStore);
  private readonly courses = inject(CourseJobTrackerStore);

  private readonly documentCount = computed(
    () => this.documents.pending$().length,
  );
  private readonly courseCount = computed(() => this.courses.live$().length);

  /** The words after "Trợ lý AI:" in the label; null when nothing is running. */
  readonly pendingText$ = computed<string | null>(() => {
    const parts: string[] = [];
    if (this.documentCount() > 0) {
      parts.push(`đang xử lý ${this.documentCount()} tài liệu`);
    }
    if (this.courseCount() > 0) {
      const progress = this.courses.progress$();
      parts.push(
        progress === null || progress === 0
          ? 'đang tạo khóa học'
          : `đang tạo khóa học (${progress}%)`,
      );
    }
    return parts.length > 0 ? parts.join(', ') : null;
  });

  readonly notice$ = computed<BackgroundNotice | null>(() => {
    const document = this.documents.lastFinished$();
    const course = this.courses.lastFinished$();
    const asDocument: BackgroundNotice | null = document
      ? {
          kind: 'document',
          fileName: document.document.fileName,
          ok: document.document.status === 'ready',
          // A file that failed is explained on its row in the documents drawer.
          href:
            document.document.status === 'ready'
              ? '/assistant'
              : '/assistant?tai-lieu=1',
          action:
            document.document.status === 'ready' ? 'Mở trợ lý' : 'Xem chi tiết',
          at: document.at,
        }
      : null;
    const failed =
      course?.job.status === 'failed' || course?.job.status === 'cancelled';
    const asCourse: BackgroundNotice | null = course
      ? {
          kind: 'course',
          fileName: course.job.sourceFileName ?? 'tài liệu nguồn',
          ok: !failed,
          href: this.courses.pathOf(course.job),
          action: failed ? 'Mở khóa học' : 'Rà soát',
          at: course.at,
        }
      : null;
    if (asDocument && asCourse) {
      return asCourse.at >= asDocument.at ? asCourse : asDocument;
    }
    return asCourse ?? asDocument;
  });

  readonly state$ = computed<OwlState>(() => {
    if (this.documentCount() > 0 || this.courseCount() > 0) return 'processing';
    const notice = this.notice$();
    if (!notice) return 'idle';
    return notice.ok ? 'done' : 'failed';
  });

  /** What a screen reader hears when the state changes; it names no count, so it speaks once. */
  readonly announcement$ = computed(() => {
    if (this.state$() === 'processing') {
      return this.documentCount() > 0
        ? 'Đang xử lý tài liệu.'
        : 'Đang tạo khóa học.';
    }
    const notice = this.notice$();
    if (!notice) return '';
    if (notice.kind === 'course') {
      return notice.ok
        ? `Khóa học từ ${notice.fileName} đã sẵn sàng để rà soát.`
        : `Không tạo được khóa học từ ${notice.fileName}.`;
    }
    return notice.ok
      ? `Đã xử lý xong tài liệu ${notice.fileName}.`
      : `Không xử lý được tài liệu ${notice.fileName}.`;
  });

  dismiss(): void {
    this.documents.dismiss();
    this.courses.dismiss();
  }
}
