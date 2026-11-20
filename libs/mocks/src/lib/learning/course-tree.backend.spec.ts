import {
  authV1Endpoints,
  courseEndpoints,
  CourseDetailSchema,
  type AnyEndpoint,
  type CourseDetail,
  type SaveDraftCommand,
} from '@lms/contracts';
import { FakeBackend, type FakeReply } from '../backend/fake-backend';
import { SEED_PASSWORD } from '../backend/seed';
import { ARCHITECTURE_VIDEO, DEPOSIT_VIDEO } from './video-notes.fixtures';

describe('video chapters and transcript in the course tree of the mock backend', () => {
  let backend: FakeBackend;
  let token: string;
  beforeEach(() => {
    backend = new FakeBackend();
    token = (
      call(authV1Endpoints.login, {
        body: { username: 'giangvien', password: SEED_PASSWORD },
      }).body.data as { accessToken: string }
    ).accessToken;
  });

  const call = (
    endpoint: AnyEndpoint,
    request: {
      params?: Record<string, string>;
      query?: Record<string, string>;
      body?: unknown;
    } = {},
  ): FakeReply =>
    backend.handle(endpoint, {
      token: endpoint === authV1Endpoints.login ? null : token,
      params: request.params ?? {},
      query: request.query ?? {},
      body: request.body,
    }) as FakeReply;

  const videoOf = (detail: CourseDetail) =>
    detail.chapters
      .flatMap((c) => c.lessons)
      .flatMap((l) => l.blocks)
      .find((b) => b.block.blockType === 'video')!.block;

  /** The save command that sends a tree back as an editor holds it. */
  function saveCommand(
    detail: CourseDetail,
    keepLists: boolean,
    allowSeeking?: boolean,
  ): SaveDraftCommand {
    return {
      expectedVersion: detail.revision.rowVersion,
      title: detail.revision.title ?? undefined,
      defaultRequirement: detail.revision.defaultRequirement,
      objectives: [],
      chapters: detail.chapters.map((c) => ({
        title: c.chapter.title,
        lessons: c.lessons.map((l) => ({
          title: l.lesson.title,
          lessonType: l.lesson.lessonType,
          estimatedDurationSeconds: l.lesson.estimatedDurationSeconds ?? 0,
          blocks: l.blocks.map((b) => ({
            blockType: b.block.blockType,
            title: b.block.title,
            completionMode: b.block.completionMode,
            assets: b.assets.map((a) => ({
              assetId: a.asset.id,
              usage: a.usage.usage,
            })),
            steps: [],
            ...(keepLists
              ? {
                  videoChapters: b.block.videoChapters,
                  transcript: b.block.transcript,
                }
              : {}),
            ...(allowSeeking === undefined ? {} : { allowSeeking }),
          })),
        })),
      })),
    } as SaveDraftCommand;
  }

  const open = (): CourseDetail =>
    CourseDetailSchema.parse(
      call(courseEndpoints.openDraft, { params: { courseId: '1' } }).body.data,
    );

  const save = (
    detail: CourseDetail,
    keepLists: boolean,
    allowSeeking?: boolean,
  ): CourseDetail =>
    CourseDetailSchema.parse(
      call(courseEndpoints.saveDraft, {
        params: {
          courseId: '1',
          revisionId: String(detail.revision.id),
        },
        body: saveCommand(detail, keepLists, allowSeeking),
      }).body.data,
    );

  it('seeds the mockup chapters and transcript on the first course video', () => {
    const published = CourseDetailSchema.parse(
      call(courseEndpoints.getCourse, { params: { courseId: '1' } }).body.data,
    );
    expect(videoOf(published).videoChapters).toEqual(
      ARCHITECTURE_VIDEO.videoChapters,
    );
    expect(videoOf(published).transcript).toHaveLength(7);
    expect(videoOf(published).transcript[1].startSeconds).toBe(50);
  });

  it('seeds one untimed transcript, with a null time on every line, on the deposit course video', () => {
    const deposit = CourseDetailSchema.parse(
      call(courseEndpoints.getCourse, { params: { courseId: '5' } }).body.data,
    );
    expect(videoOf(deposit).transcript).toEqual(DEPOSIT_VIDEO.transcript);
    expect(videoOf(deposit).transcript).toHaveLength(2);
    expect(
      videoOf(deposit).transcript.every((line) => line.startSeconds === null),
    ).toBe(true);
  });

  it('copies them into a new draft', () => {
    expect(videoOf(open()).videoChapters).toEqual(
      ARCHITECTURE_VIDEO.videoChapters,
    );
  });

  it('keeps them when a save sends them back, and clears them when it does not', () => {
    const draft = open();
    const kept = save(draft, true);
    expect(videoOf(kept).videoChapters).toEqual(
      ARCHITECTURE_VIDEO.videoChapters,
    );
    expect(videoOf(kept).transcript).toEqual(ARCHITECTURE_VIDEO.transcript);

    const cleared = save(kept, false);
    expect(videoOf(cleared).videoChapters).toEqual([]);
    expect(videoOf(cleared).transcript).toEqual([]);
  });

  it('seeds every block with seeking off', () => {
    expect(videoOf(open()).allowSeeking).toBe(false);
  });

  it('round-trips allowSeeking through a save and into the next draft', () => {
    const on = save(open(), true, true);
    expect(videoOf(on).allowSeeking).toBe(true);

    const reopened = CourseDetailSchema.parse(
      call(courseEndpoints.getCourse, {
        params: { courseId: '1' },
        query: { revisionId: String(on.revision.id) },
      }).body.data,
    );
    expect(videoOf(reopened).allowSeeking).toBe(true);

    const off = save(on, true, false);
    expect(videoOf(off).allowSeeking).toBe(false);
    expect(videoOf(save(save(off, true, true), true)).allowSeeking).toBe(false);
  });
});
