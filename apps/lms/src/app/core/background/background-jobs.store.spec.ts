import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { CourseJobSummary, KnowledgeDocument } from '@lms/contracts';
import { knowledgeDocumentFixtures } from '@lms/mocks';
import { CourseJobTrackerStore } from '../course-jobs/course-job-tracker.store';
import { DocumentTrackerStore } from '../knowledge/document-tracker.store';
import { BackgroundJobsStore } from './background-jobs.store';

const document = knowledgeDocumentFixtures[0];
const running: CourseJobSummary = {
  jobId: 5,
  status: 'running',
  step: 'outline',
  progress: 25,
  error: null,
  sourceFileName: 'quy-trinh.md',
  createdDraftId: null,
  createTime: '2026-11-10T09:00:00.000Z',
};

class FakeDocuments {
  readonly pending$ = signal<readonly KnowledgeDocument[]>([]);
  readonly lastFinished$ = signal<{
    document: KnowledgeDocument;
    at: number;
  } | null>(null);
  readonly dismiss = vi.fn();
}

class FakeCourses {
  readonly live$ = signal<readonly CourseJobSummary[]>([]);
  readonly lastFinished$ = signal<{
    job: CourseJobSummary;
    at: number;
  } | null>(null);
  readonly progress$ = signal<number | null>(null);
  readonly dismiss = vi.fn();
  pathOf = (id: number) => `/admin/courses/ai-drafts/${id}`;
}

describe('BackgroundJobsStore', () => {
  let documents: FakeDocuments;
  let courses: FakeCourses;
  let store: BackgroundJobsStore;

  beforeEach(() => {
    documents = new FakeDocuments();
    courses = new FakeCourses();
    TestBed.configureTestingModule({
      providers: [
        { provide: DocumentTrackerStore, useValue: documents },
        { provide: CourseJobTrackerStore, useValue: courses },
      ],
    });
    store = TestBed.inject(BackgroundJobsStore);
  });

  it('is idle with nothing to wait for', () => {
    expect(store.state$()).toBe('idle');
    expect(store.pendingText$()).toBeNull();
    expect(store.notice$()).toBeNull();
  });

  it('names a document being read and a course being written together', () => {
    documents.pending$.set([document]);
    courses.live$.set([running]);
    courses.progress$.set(25);

    expect(store.state$()).toBe('processing');
    expect(store.pendingText$()).toBe(
      'đang xử lý 1 tài liệu, đang tạo khóa học (25%)',
    );
  });

  it('announces the course when only it is running', () => {
    courses.live$.set([running]);

    expect(store.announcement$()).toBe('Đang tạo khóa học.');
  });

  it('points the notice of a finished course at its review screen', () => {
    courses.lastFinished$.set({
      job: { ...running, status: 'waiting_approval' },
      at: 10,
    });

    expect(store.state$()).toBe('done');
    expect(store.notice$()).toMatchObject({
      kind: 'course',
      ok: true,
      href: '/admin/courses/ai-drafts/5',
      action: 'Rà soát',
    });
    expect(store.announcement$()).toBe(
      'Khóa học từ quy-trinh.md đã sẵn sàng để rà soát.',
    );
  });

  it('shows the plain face for a failed course and keeps the newest of two notices', () => {
    documents.lastFinished$.set({
      document: { ...document, status: 'ready' },
      at: 5,
    });
    courses.lastFinished$.set({
      job: { ...running, status: 'failed', error: 'Lỗi' },
      at: 9,
    });

    expect(store.state$()).toBe('failed');
    expect(store.notice$()?.kind).toBe('course');
    expect(store.announcement$()).toBe(
      'Không tạo được khóa học từ quy-trinh.md.',
    );
  });

  it('dismisses every source', () => {
    store.dismiss();

    expect(documents.dismiss).toHaveBeenCalled();
    expect(courses.dismiss).toHaveBeenCalled();
  });
});
