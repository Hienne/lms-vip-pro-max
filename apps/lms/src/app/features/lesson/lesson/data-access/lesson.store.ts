import {
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  inject,
  Injectable,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  courseEndpoints,
  learnerEndpoints,
  learnerQuizEndpoints,
  toUrl,
  type BlockDetail,
  type BlockProgress,
  type AnchorCommand,
  type AssetDetail,
  type CourseEnrollment,
  type Anchor,
  type LessonDetail,
  type LessonNoteView,
  type LessonProgress,
  type ProgressResult,
} from '@lms/contracts';
import { map } from 'rxjs';
import { serverData } from '../../../../core/data-access/server-data';
import { serverMutation } from '../../../../core/data-access/server-mutation';
import { FileSaver } from '../../../../core/files/file-saver';
import { EndpointClient } from '../../../../core/http/endpoint-client';
import { readLearnerCourse } from '../../../../core/learning/read-learner-course';
import { SessionStore } from '../../../../core/session/session.store';
import { clock } from '../anchor';
import type { BlockJump } from '../components/pdf-block/pdf-block';
import { lessonNotes } from './lesson-notes';
import { StudyChannel, type ClaimTarget } from './study-channel';
import { StudySessionStorage } from './study-session.storage';

export type LessonView =
  | 'loading'
  | 'missing'
  | 'not-enrolled'
  | 'quiz'
  | 'empty'
  | 'ready';

export type ProgressState = 'not_started' | 'in_progress' | 'completed';

export interface BlockView {
  readonly detail: BlockDetail;
  readonly id: number;
  readonly title: string;
  readonly status: ProgressState;
  readonly percent: number;
}

export interface OutlineLesson {
  readonly id: number;
  readonly title: string;
  readonly state: ProgressState;
  readonly quiz: boolean;
  /** A quiz lesson opens here too: the player shows its quiz. */
  readonly link: string;
  readonly current: boolean;
}

export interface OutlineChapter {
  readonly id: number;
  readonly title: string;
  readonly lessons: readonly OutlineLesson[];
}

const NO_ANCHOR: AnchorCommand = { type: 'none' };

interface Results {
  readonly blocks: ReadonlyMap<number, BlockProgress>;
  readonly lessons: ReadonlyMap<number, LessonProgress>;
  readonly enrollment: CourseEnrollment | null;
}

const NO_RESULTS: Results = {
  blocks: new Map(),
  lessons: new Map(),
  enrollment: null,
};

const progressState = (status: string | undefined): ProgressState =>
  status === 'completed' || status === 'in_progress' ? status : 'not_started';

const idParam = (value: string | null): number | undefined => {
  const id = Number(value);
  return value && Number.isInteger(id) && id > 0 ? id : undefined;
};

/** The side panel's tabs. */
export type SideTab = 'outline' | 'notes';

/** A block shown from a given page or second: what an anchor asks for. */
interface JumpTo extends BlockJump {
  readonly blockId: number;
}

const sameJump = (a: JumpTo | null, b: JumpTo | null) =>
  a?.blockId === b?.blockId && a?.value === b?.value && a?.seq === b?.seq;

const whole = (value: string | null): number | undefined => {
  const n = Number(value);
  return value !== null && value !== '' && Number.isInteger(n) && n >= 0
    ? n
    : undefined;
};

const sameTarget = (a: ClaimTarget | undefined, b: ClaimTarget | undefined) =>
  a?.enrollmentId === b?.enrollmentId &&
  a?.blockId === b?.blockId &&
  a?.video === b?.video;

/**
 * The lesson player's page state: the learner's course (card and content in one call), the enrolment detail, the active
 * block and the study session on it (`StudyChannel`). Progress, completion and percentages are the
 * server's: each accepted event's result replaces what is shown until the detail is read again.
 */
@Injectable()
export class LessonStore {
  private readonly client = inject(EndpointClient);
  private readonly saver = inject(FileSaver);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);
  private readonly document = inject(DOCUMENT);
  private readonly storage = inject(StudySessionStorage);

  readonly courseId$ = toSignal(
    this.route.paramMap.pipe(map((p) => idParam(p.get('courseId')))),
    { initialValue: idParam(this.route.snapshot.paramMap.get('courseId')) },
  );
  readonly lessonId$ = toSignal(
    this.route.paramMap.pipe(map((p) => idParam(p.get('lessonId')))),
    { initialValue: idParam(this.route.snapshot.paramMap.get('lessonId')) },
  );
  private readonly queryBlockId = toSignal(
    this.route.queryParamMap.pipe(map((p) => idParam(p.get('block')))),
    { initialValue: idParam(this.route.snapshot.queryParamMap.get('block')) },
  );

  /** `?page=` and `?t=` next to `?block=`: a link from "Đã lưu & ghi chú" to a spot of the block. */
  private readonly queryPage = toSignal(
    this.route.queryParamMap.pipe(map((p) => whole(p.get('page')))),
    { initialValue: whole(this.route.snapshot.queryParamMap.get('page')) },
  );
  private readonly queryTime = toSignal(
    this.route.queryParamMap.pipe(map((p) => whole(p.get('t')))),
    { initialValue: whole(this.route.snapshot.queryParamMap.get('t')) },
  );

  private readonly courseData = serverData(
    (courseId: number) => readLearnerCourse(this.client, courseId),
    { params: () => this.courseId$() },
  );

  private readonly detailData = serverData(
    (enrollmentId: number) =>
      this.client.call(learnerEndpoints.enrollment, {
        params: { enrollmentId },
      }),
    { params: () => this.courseData.value()?.card.enrollmentId ?? undefined },
  );

  /** The course's quizzes, read only for a quiz lesson: the one that holds the lesson is shown. */
  private readonly quizData = serverData(
    (courseId: number) =>
      this.client.call(learnerQuizEndpoints.courseQuizzes, {
        params: { courseId },
      }),
    {
      params: () => (this.view$() === 'quiz' ? this.courseId$() : undefined),
    },
  );

  private readonly state = {
    /** The block the learner chose in this lesson; it wins over the URL and the resume point. */
    selected: linkedSignal<number | undefined, number | undefined>({
      source: () => this.lessonId$(),
      computation: () => undefined,
    }),
    /** The "Mục lục" drawer below `lg`; a new lesson closes it. */
    outlineOpen: linkedSignal<number | undefined, boolean>({
      source: () => this.lessonId$(),
      computation: () => false,
    }),
    /** The side panel tab: the outline, or the notes of this lesson. */
    sideTab: signal<SideTab>('outline'),
    /** Where the learner is in the active block, as its player tells; a new block starts over. */
    position: linkedSignal<
      number | undefined,
      { readonly page: number | null; readonly second: number }
    >({
      source: () => this.activeBlock$()?.id,
      computation: () => ({ page: null, second: 0 }),
    }),
    /** The spot an anchor asked the active block to show; another block or lesson drops it. */
    jump: linkedSignal<number | undefined, JumpTo | null>({
      source: () => this.lessonId$(),
      computation: () => null,
    }),
    /** Accepted results, shown instead of the detail's progress until it is read again. */
    results: linkedSignal<unknown, Results>({
      source: () => this.detailData.value(),
      computation: () => NO_RESULTS,
    }),
  };

  /** Tells two jumps to the same spot apart. */
  private jumpSeq = 0;

  /** Reads the player of the video block on screen, which the page hands over (`watchVideo`). */
  private videoPosition: (() => number) | undefined;

  private readonly channel = new StudyChannel({
    client: this.client,
    storage: this.storage,
    userId: () => this.session.user$()?.userId,
    visible: () => this.document.visibilityState !== 'hidden',
    position: () => this.videoPosition?.(),
    accepted: (result) => this.addResult(result),
    resync: () => this.detailData.reload(),
  });

  // Selectors
  readonly card$ = computed(() => this.courseData.value()?.card);
  readonly detail$ = this.detailData.value;
  readonly loadError$ = computed(
    () => this.courseData.error() ?? this.detailData.error(),
  );
  readonly outlineOpen$ = this.state.outlineOpen.asReadonly();

  /** The quiz this lesson holds, matched by the lesson the server links it to. */
  readonly quiz$ = computed(() =>
    this.quizData.value()?.find((c) => c.lessonId === this.lessonId$()),
  );
  readonly quizLoading$ = this.quizData.isLoading;
  readonly quizError$ = this.quizData.error;
  readonly phase$ = this.channel.phase$;
  readonly save$ = this.channel.save$;
  readonly studyError$ = this.channel.error$;
  /** Where the active block resumes: the claim's progress row. */
  readonly resume$ = computed(() => this.channel.session$()?.resume ?? null);

  private readonly chapters = computed(
    () => this.courseData.value()?.content.chapters ?? [],
  );
  private readonly lessons = computed(() =>
    this.chapters().flatMap((c) => c.lessons),
  );

  private readonly lessonIndex = computed(() =>
    this.lessons().findIndex((l) => l.lesson.id === this.lessonId$()),
  );

  readonly lesson$ = computed((): LessonDetail | undefined => {
    const index = this.lessonIndex();
    return index < 0 ? undefined : this.lessons()[index];
  });

  readonly chapterTitle$ = computed(
    () =>
      this.chapters().find((c) =>
        c.lessons.some((l) => l.lesson.id === this.lessonId$()),
      )?.chapter.title ?? '',
  );

  readonly lessonPosition$ = computed(() => ({
    number: this.lessonIndex() + 1,
    total: this.lessons().length,
  }));

  readonly view$ = computed((): LessonView => {
    if (this.courseId$() === undefined || this.lessonId$() === undefined) {
      return 'missing';
    }
    const course = this.courseData.value();
    if (course === undefined) return 'loading';
    if (course === null) return 'missing';
    if (course.card.enrollmentId == null) return 'not-enrolled';
    if (this.detail$() === undefined) return 'loading';
    const lesson = this.lesson$();
    if (!lesson) return 'missing';
    if (lesson.lesson.lessonType === 'quiz') return 'quiz';
    return lesson.blocks.length ? 'ready' : 'empty';
  });

  readonly blocks$ = computed((): readonly BlockView[] => {
    const { blocks } = this.state.results();
    const loaded = new Map(this.detail$()?.blocks.map((b) => [b.blockId, b]));
    return (this.lesson$()?.blocks ?? []).map((detail) => {
      const progress =
        blocks.get(detail.block.id) ?? loaded.get(detail.block.id);
      return {
        detail,
        id: detail.block.id,
        title: detail.block.title,
        status: progressState(progress?.status),
        percent: Math.round(progress?.progressPercent ?? 0),
      };
    });
  });

  readonly activeBlock$ = computed((): BlockView | undefined => {
    const blocks = this.blocks$();
    const has = (id: number | null | undefined) =>
      blocks.find((b) => b.id === id);
    return (
      has(this.state.selected()) ??
      has(this.queryBlockId()) ??
      has(this.detail$()?.enrollment.lastBlockId) ??
      blocks[0]
    );
  });

  readonly nextBlockId$ = computed(() => this.neighbour(1));
  readonly prevBlockId$ = computed(() => this.neighbour(-1));

  private neighbour(step: 1 | -1): number | undefined {
    const blocks = this.blocks$();
    const index = blocks.findIndex((b) => b.id === this.activeBlock$()?.id);
    return index < 0 ? undefined : blocks[index + step]?.id;
  }

  // Notes and bookmarks of the lesson
  private readonly lessonNotes = lessonNotes(() =>
    this.view$() === 'ready' ? this.lessonId$() : undefined,
  );
  readonly notes$ = computed(() => this.lessonNotes.notes() ?? []);
  readonly bookmarks$ = computed(() => this.lessonNotes.bookmarks() ?? []);
  /** The number in the "Ghi chú" tab; none until the notes are read. */
  readonly noteCount$ = computed(() => this.lessonNotes.notes()?.length);
  readonly notesLoading$ = this.lessonNotes.loading;
  readonly notesError$ = this.lessonNotes.error;
  readonly noteSaving$ = this.lessonNotes.saving;
  readonly bookmarkBusy$ = this.lessonNotes.toggling;
  /** Changes when a note was saved: the note form empties. */
  readonly noteAdded$ = this.lessonNotes.added;
  readonly sideTab$ = this.state.sideTab.asReadonly();

  /** Where a new note would go: the page or second on screen, else the whole lesson. */
  readonly anchor$ = computed((): AnchorCommand => {
    const active = this.view$() === 'ready' ? this.activeBlock$() : undefined;
    const { page, second } = this.state.position();
    switch (active?.detail.block.blockType) {
      case 'pdf':
        return page ? { type: 'pdf', blockId: active.id, page } : NO_ANCHOR;
      case 'video':
        return { type: 'video', blockId: active.id, second };
      default:
        return NO_ANCHOR;
    }
  });
  readonly anchorLabel$ = computed(() => {
    const anchor = this.anchor$();
    return anchor.type === 'pdf'
      ? `Trang ${anchor.page}`
      : anchor.type === 'video'
        ? `Video ${clock(anchor.second)}`
        : 'bài học';
  });

  /** The spot on screen already has a bookmark. */
  readonly bookmarked$ = computed(() => {
    const here = this.anchor$();
    return (
      here.type !== 'none' &&
      this.bookmarks$().some(
        ({ anchor }) =>
          anchor.type === here.type &&
          anchor.blockId === here.blockId &&
          (here.type === 'pdf'
            ? anchor.page === here.page
            : anchor.second === here.second),
      )
    );
  });

  private readonly urlJump = computed(
    (): JumpTo | null => {
      const active = this.activeBlock$();
      if (!active || active.id !== this.queryBlockId()) return null;
      const type = active.detail.block.blockType;
      const value =
        type === 'pdf'
          ? this.queryPage()
          : type === 'video'
            ? this.queryTime()
            : undefined;
      return value === undefined || (type === 'pdf' && value < 1)
        ? null
        : { blockId: active.id, value, seq: 0 };
    },
    { equal: sameJump },
  );

  /** The page the PDF on screen has to show now: an anchor followed here, else the link's. */
  readonly pdfJump$ = computed(() => this.jumpFor('pdf'), { equal: sameJump });
  /** The second the video on screen has to move to. */
  readonly videoJump$ = computed(() => this.jumpFor('video'), {
    equal: sameJump,
  });

  private jumpFor(type: 'pdf' | 'video'): JumpTo | null {
    const active = this.activeBlock$();
    if (active?.detail.block.blockType !== type) return null;
    const asked = this.state.jump();
    return asked?.blockId === active.id ? asked : this.urlJump();
  }

  /** The block's file, loadable only while this tab holds the session (the media cookie). */
  readonly contentUrl$ = computed((): string | null => {
    const active = this.activeBlock$();
    const asset = active?.detail.assets[0]?.asset;
    const enrollmentId = this.card$()?.enrollmentId;
    if (!active || !asset || !enrollmentId || this.phase$() !== 'ready') {
      return null;
    }
    const url = toUrl(courseEndpoints.getAssetContent, { assetId: asset.id });
    return `${url}?blockId=${active.id}&enrollmentId=${enrollmentId}`;
  });

  /** An attachment saved under its original name; a refusal shows as a toast. */
  private readonly downloads = serverMutation(
    (input: {
      readonly asset: AssetDetail;
      readonly blockId: number;
      readonly enrollmentId: number;
    }) =>
      this.client
        .call(courseEndpoints.getAssetContent, {
          params: { assetId: input.asset.asset.id },
          query: { blockId: input.blockId, enrollmentId: input.enrollmentId },
        })
        .pipe(map((blob) => ({ blob, name: input.asset.asset.originalName }))),
    {
      errors: 'toast',
      success: (_, saved) => ({ title: 'Đã tải xuống', detail: saved.name }),
      onSuccess: (saved) => this.saver.save(saved.blob, saved.name),
    },
  );

  readonly downloading$ = this.downloads.isPending;

  readonly completion$ = computed(() => {
    const active = this.activeBlock$();
    const blocks = this.state.results().blocks;
    const progress =
      (active && blocks.get(active.id)) ??
      this.detail$()?.blocks.find((b) => b.blockId === active?.id);
    return {
      done: active?.status === 'completed',
      completedAt: progress?.completedAt ?? null,
      percent: active?.percent ?? 0,
      threshold: active?.detail.block.completionThreshold ?? null,
      manual: active?.detail.block.completionMode === 'manual',
    };
  });

  /** The enrolment's percentage as the server last said it. */
  readonly courseProgress$ = computed(
    () =>
      this.state.results().enrollment?.progressPercent ??
      this.detail$()?.enrollment.progressPercent ??
      0,
  );

  readonly outline$ = computed((): readonly OutlineChapter[] => {
    const courseId = this.courseId$();
    const { lessons } = this.state.results();
    const loaded = new Map(this.detail$()?.lessons.map((l) => [l.lessonId, l]));
    return this.chapters().map(({ chapter, lessons: inChapter }) => ({
      id: chapter.id,
      title: chapter.title,
      lessons: inChapter.map(({ lesson }) => {
        const quiz = lesson.lessonType === 'quiz';
        return {
          id: lesson.id,
          title: lesson.title,
          quiz,
          state: progressState(
            (lessons.get(lesson.id) ?? loaded.get(lesson.id))?.status,
          ),
          link: `/lesson/${courseId}/${lesson.id}`,
          current: lesson.id === this.lessonId$(),
        };
      }),
    }));
  });

  private readonly orderedLessons = computed(() =>
    this.outline$().flatMap((c) => c.lessons),
  );

  readonly prevLessonLink$ = computed(() => this.lessonLink(-1));
  readonly nextLessonLink$ = computed(() => this.lessonLink(1));

  private lessonLink(step: 1 | -1): string | null {
    const lessons = this.orderedLessons();
    const index = lessons.findIndex((l) => l.current);
    return index < 0 ? null : (lessons[index + step]?.link ?? null);
  }

  private readonly claimTarget = computed(
    (): ClaimTarget | undefined => {
      const active = this.view$() === 'ready' ? this.activeBlock$() : undefined;
      const enrollmentId = this.card$()?.enrollmentId;
      return active && enrollmentId
        ? {
            enrollmentId,
            blockId: active.id,
            video: active.detail.block.blockType === 'video',
          }
        : undefined;
    },
    { equal: sameTarget },
  );

  /** The session follows the active block: claimed on entry and on every block change. */
  private readonly followBlock = effect(() => {
    const target = this.claimTarget();
    untracked(() => this.channel.switchTo(target));
  });

  /** The URL follows the active block, so a reload and the back button keep it. */
  private readonly followUrl = effect(() => {
    const active = this.view$() === 'ready' ? this.activeBlock$() : undefined;
    const inUrl = this.queryBlockId();
    if (active && active.id !== inUrl) {
      untracked(() => this.writeBlockToUrl(active.id));
    }
  });

  /** A tab whose user signed out must not leave a session id for the next one. */
  private readonly forgetOnSignOut = effect(() => {
    if (!this.session.isSignedIn$()) {
      untracked(() => this.storage.clearAll());
    }
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.channel.destroy());
  }

  // Commands
  selectBlock(blockId: number): void {
    this.state.selected.set(blockId);
    this.state.jump.set(null);
  }

  /** "Tải xuống" on an attachment. */
  download(asset: AssetDetail): void {
    const blockId = this.activeBlock$()?.id;
    const enrollmentId = this.card$()?.enrollmentId;
    if (blockId && enrollmentId) {
      this.downloads.run({ asset, blockId, enrollmentId });
    }
  }

  setSideTab(tab: string): void {
    this.state.sideTab.set(tab === 'notes' ? 'notes' : 'outline');
  }

  /** The PDF on screen shows this page. */
  pdfPageChange(page: number): void {
    this.state.position.update((p) => ({ ...p, page }));
  }

  /** The video on screen is at this whole second. */
  videoSecond(second: number): void {
    this.state.position.update((p) => ({ ...p, second }));
  }

  /** "Lưu ghi chú": a note at the spot on screen. */
  addNote(text: string): void {
    const lessonId = this.lessonId$();
    if (lessonId !== undefined) {
      this.lessonNotes.add({ lessonId, anchor: this.anchor$(), text });
    }
  }

  /** The bin of a note; it asks first. */
  deleteNote(note: LessonNoteView): void {
    this.lessonNotes.remove(note);
  }

  /** The bookmark button of the block on screen: on, or off if the spot is already marked. */
  toggleBookmark(value: number): void {
    const lessonId = this.lessonId$();
    const active = this.activeBlock$();
    const type = active?.detail.block.blockType;
    if (lessonId === undefined || !active) return;
    if (type === 'pdf') {
      this.lessonNotes.toggle({
        lessonId,
        anchor: { type, blockId: active.id, page: value },
      });
    } else if (type === 'video') {
      this.lessonNotes.toggle({
        lessonId,
        anchor: { type, blockId: active.id, second: value },
      });
    }
  }

  /** The anchor of a note or bookmark: opens its block, then shows its page or second. */
  followAnchor(anchor: Anchor): void {
    const value = anchor.type === 'pdf' ? anchor.page : anchor.second;
    if (anchor.type === 'none' || anchor.blockId === null || value === null) {
      return;
    }
    if (anchor.blockId !== this.activeBlock$()?.id) {
      this.selectBlock(anchor.blockId);
    }
    this.state.jump.set({
      blockId: anchor.blockId,
      value,
      seq: ++this.jumpSeq,
    });
    this.closeOutline();
  }

  retryNotes(): void {
    this.lessonNotes.retry();
  }

  openOutline(): void {
    this.state.outlineOpen.set(true);
  }

  closeOutline(): void {
    this.state.outlineOpen.set(false);
  }

  markComplete(): void {
    this.channel.send({ type: 'COMPLETE', complete: true });
  }

  /** "Học trên thiết bị này": the learner agreed to move the session here. */
  takeOver(): void {
    this.channel.takeOver();
  }

  /** "Tải lại bài": read the enrolment again and claim the block again. */
  reloadLesson(): void {
    this.detailData.reload();
    this.channel.reclaim();
  }

  /** "Thử lại" on a file that would not load: claim again, which renews the media cookie. */
  reloadMedia(): void {
    this.channel.reclaim();
  }

  /** "Thử lại" after a failed claim or a failed save. */
  retry(): void {
    this.channel.retry();
  }

  retryQuiz(): void {
    this.quizData.reload();
  }

  retryLoad(): void {
    this.courseData.reload();
    this.detailData.reload();
  }

  /** The page tells where the video on screen is now, or none; a closed block ends at that spot. */
  watchVideo(position: (() => number) | undefined): void {
    this.videoPosition = position;
  }

  videoPlay(positionSeconds: number): void {
    this.channel.send({ type: 'PLAY', playing: true, positionSeconds });
  }

  /** Every 10 s while the video plays; carries the range played since the last report. */
  videoBeat(positionSeconds: number): void {
    this.channel.send({ type: 'HEARTBEAT', playing: true, positionSeconds });
  }

  /** A pause or the end of the video. */
  videoPause(positionSeconds: number): void {
    this.channel.send({ type: 'PAUSE', playing: false, positionSeconds });
  }

  /** A seek from `from` to `to`; the range played up to `from` is closed first. */
  videoSeek(from: number, to: number, playing: boolean): void {
    this.channel.seek(from, to, playing);
  }

  pdfPage(pdfPage: number): void {
    this.channel.send({ type: 'PDF_PAGE', pdfPage });
  }

  private addResult(result: ProgressResult): void {
    this.state.results.update((r) => ({
      blocks: new Map(r.blocks).set(result.block.blockId, result.block),
      lessons: new Map(r.lessons).set(result.lesson.lessonId, result.lesson),
      enrollment: result.enrollment,
    }));
  }

  private writeBlockToUrl(blockId: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { block: blockId, page: null, t: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
