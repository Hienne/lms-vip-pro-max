import { CreateCourseCommandSchema } from '@lms/contracts';
import { courseDetailFixtures } from '@lms/mocks';
import {
  draftChecks,
  emptyDraftValue,
  lessonProblem,
  mergeLive,
  newBlock,
  newLesson,
  toCreateCourseCommand,
  toDraftValue,
  toSaveDraftCommand,
  type CourseDraftValue,
  type LessonValue,
} from './course-draft';

describe('course draft', () => {
  const eod = courseDetailFixtures.find((d) => d.course.code === 'VH-301')!;

  it('round-trips a revision into the save command, minutes as seconds', () => {
    const command = toSaveDraftCommand(toDraftValue(eod), 3);

    expect(command.expectedVersion).toBe(3);
    expect(command.title).toBe(eod.revision.title);
    expect(command.programId).toBe(eod.revision.programId);
    expect(command.objectives).toEqual(
      eod.objectives.map((o) => o.description),
    );
    expect(command.chapters.map((c) => c.title)).toEqual(
      eod.chapters.map((c) => c.chapter.title),
    );
    expect(command.chapters[0].lessons[0].estimatedDurationSeconds).toBe(
      eod.chapters[0].lessons[0].lesson.estimatedDurationSeconds,
    );
  });

  it('leaves out empty optional fields and blank objectives', () => {
    const value = {
      ...toDraftValue(eod),
      summary: '  ',
      moduleId: '',
      level: '' as const,
      objectives: ['  ', 'Biết chạy EOD'],
    };
    const command = toSaveDraftCommand(value, 0);

    expect(command).not.toHaveProperty('summary');
    expect(command).not.toHaveProperty('moduleId');
    expect(command).not.toHaveProperty('level');
    expect(command.objectives).toEqual(['Biết chạy EOD']);
  });

  it('sends no blocks for a quiz lesson and parses process steps', () => {
    const process = {
      ...newBlock('process'),
      steps: [
        { title: 'Tiếp nhận', description: '' },
        { title: ' ', description: 'bỏ' },
      ],
    };
    const lesson: LessonValue = { ...newLesson(1), blocks: [process] };
    const value = {
      ...toDraftValue(eod),
      chapters: [
        { key: 'a', title: 'C', lessons: [lesson] },
        {
          key: 'b',
          title: 'D',
          lessons: [{ ...lesson, lessonType: 'quiz' as const }],
        },
      ],
    };
    const [first, second] = toSaveDraftCommand(value, 0).chapters;

    expect(first.lessons[0].blocks[0].steps).toEqual([{ title: 'Tiếp nhận' }]);
    expect(second.lessons[0].blocks).toEqual([]);
  });

  it('sends back the chapters and transcript of a loaded video block, unchanged', () => {
    const architecture = courseDetailFixtures.find(
      (d) => d.course.code === 'NV-101',
    )!;
    const loaded = architecture.chapters
      .flatMap((c) => c.lessons)
      .flatMap((l) => l.blocks)
      .find((b) => b.block.blockType === 'video')!.block;
    expect(loaded.videoChapters.length).toBeGreaterThan(0);

    const command = toSaveDraftCommand(toDraftValue(architecture), 0);
    const video = command.chapters
      .flatMap((c) => c.lessons)
      .flatMap((l) => l.blocks)
      .find((b) => b.blockType === 'video')!;

    expect(video.videoChapters).toEqual(loaded.videoChapters);
    expect(video.transcript).toEqual(loaded.transcript);
  });

  it('sends no lists for a new video block or a block that is not a video', () => {
    const lesson: LessonValue = {
      ...newLesson(1),
      blocks: [newBlock('video'), newBlock('text')],
    };
    const value = {
      ...toDraftValue(eod),
      chapters: [{ key: 'a', title: 'C', lessons: [lesson] }],
    };
    const [video, text] = toSaveDraftCommand(value, 0).chapters[0].lessons[0]
      .blocks;

    expect(video).not.toHaveProperty('videoChapters');
    expect(video).not.toHaveProperty('transcript');
    expect(text).not.toHaveProperty('videoChapters');
  });

  it('keeps the quiz of a quiz lesson both ways and drops it from a content lesson', () => {
    const detail = structuredClone(eod);
    const lessons = detail.chapters[0].lessons;
    lessons[0].lesson.lessonType = 'quiz';
    lessons[0].lesson.quizId = 7;
    lessons[0].blocks = [];
    expect(toDraftValue(detail).chapters[0].lessons[0].quizId).toBe(7);
    expect(
      toDraftValue(detail).chapters[0].lessons[1]?.quizId ?? null,
    ).toBeNull();

    const value = toDraftValue(detail);
    const sent = toSaveDraftCommand(value, 0).chapters[0].lessons;
    expect(sent[0]).toMatchObject({
      lessonType: 'quiz',
      quizId: 7,
      blocks: [],
    });

    const asContent = {
      ...value,
      chapters: [
        {
          ...value.chapters[0],
          lessons: [
            { ...value.chapters[0].lessons[0], lessonType: 'content' as const },
          ],
        },
      ],
    };
    expect(
      toSaveDraftCommand(asContent, 0).chapters[0].lessons[0],
    ).not.toHaveProperty('quizId');
    expect(
      toSaveDraftCommand(
        {
          ...value,
          chapters: [
            {
              ...value.chapters[0],
              lessons: [{ ...value.chapters[0].lessons[0], quizId: null }],
            },
          ],
        },
        0,
      ).chapters[0].lessons[0],
    ).not.toHaveProperty('quizId');
  });

  it('flags a quiz lesson that has no quiz yet', () => {
    const quiz = { ...newLesson(1), lessonType: 'quiz' as const };
    expect(lessonProblem(quiz)).toBe('Chưa chọn bài kiểm tra');
    expect(lessonProblem({ ...quiz, quizId: 3 })).toBeNull();
  });

  it('flags a content lesson without blocks or without its file', () => {
    expect(lessonProblem(newLesson(1))).toBe('Thiếu nội dung');
    expect(
      lessonProblem({ ...newLesson(1), blocks: [newBlock('video')] }),
    ).toBe('Thiếu tệp');
    expect(
      lessonProblem({ ...newLesson(1), blocks: [newBlock('attachment')] }),
    ).toBeNull();
  });

  it('lists what blocks publishing, the objectives being only advised', () => {
    const empty = { ...toDraftValue(eod), objectives: [], chapters: [] };
    const checks = draftChecks(empty);

    expect(checks.filter((c) => !c.ok).map((c) => c.label)).toEqual([
      'Có ít nhất 1 bài học',
      'Có mục tiêu đầu ra (khuyến nghị)',
      'Đã cấu hình bài kiểm tra cuối khóa (khuyến nghị)',
    ]);
    expect(checks.find((c) => c.label.includes('mục tiêu'))?.optional).toBe(
      true,
    );
  });

  it('round-trips the cover image, left out when there is none', () => {
    const value = toDraftValue({
      ...eod,
      revision: { ...eod.revision, coverAssetId: 42 },
    });
    expect(value.coverAssetId).toBe(42);
    expect(toSaveDraftCommand(value, 1).coverAssetId).toBe(42);
    expect(toCreateCourseCommand(value, 'X', 1).draft?.coverAssetId).toBe(42);

    const none = { ...value, coverAssetId: null };
    expect(toSaveDraftCommand(none, 1)).not.toHaveProperty('coverAssetId');
    expect(emptyDraftValue().coverAssetId).toBeNull();
  });

  describe('the final exam', () => {
    it('round-trips the final quiz as a select value, left out when empty', () => {
      const value = toDraftValue({ ...eod, finalQuizId: 2 });
      expect(value.finalQuizId).toBe('2');
      expect(toSaveDraftCommand(value, 1).finalQuizId).toBe(2);
      expect(toCreateCourseCommand(value, 'X', 1).draft?.finalQuizId).toBe(2);

      const none = toDraftValue({ ...eod, finalQuizId: null });
      expect(none.finalQuizId).toBe('');
      expect(toSaveDraftCommand(none, 1)).not.toHaveProperty('finalQuizId');
      expect(toCreateCourseCommand(none, 'X', 1).draft).not.toHaveProperty(
        'finalQuizId',
      );
      expect(emptyDraftValue().finalQuizId).toBe('');
    });

    it('advises configuring one, and requires it to be published once chosen', () => {
      const base = { ...toDraftValue(eod), objectives: ['Mục tiêu'] };
      const find = (checks: ReturnType<typeof draftChecks>, text: string) =>
        checks.find((c) => c.label.includes(text));

      const none = draftChecks(base);
      expect(find(none, 'Đã cấu hình bài kiểm tra cuối khóa')).toMatchObject({
        ok: false,
        optional: true,
        step: 2,
      });
      expect(find(none, 'đã xuất bản')).toBeUndefined();

      const chosen = { ...base, finalQuizId: '2' };
      const draft = draftChecks(chosen, [
        { id: 2, status: 'DRAFT', selectionMode: 'FIXED' },
      ]);
      expect(find(draft, 'Đã cấu hình bài kiểm tra cuối khóa')?.ok).toBe(true);
      expect(find(draft, 'Bài kiểm tra cuối khóa đã xuất bản')).toMatchObject({
        ok: false,
        step: 2,
      });
      expect(find(draft, 'Bài kiểm tra cuối khóa đã xuất bản')?.optional).toBe(
        undefined,
      );

      const published = draftChecks(chosen, [
        { id: 2, status: 'PUBLISHED', selectionMode: 'FIXED' },
      ]);
      expect(find(published, 'Bài kiểm tra cuối khóa đã xuất bản')?.ok).toBe(
        true,
      );
    });

    it('lets a draft exam of the wizard through, since the publish brings it along', () => {
      const chosen = {
        ...toDraftValue(eod),
        objectives: ['Mục tiêu'],
        finalQuizId: '2',
      };
      const checks = draftChecks(chosen, [
        { id: 2, status: 'DRAFT', selectionMode: 'RANDOM_POOL' },
      ]);

      expect(
        checks.find((c) => c.label.includes('xuất bản cùng khóa học')),
      ).toMatchObject({ ok: true, step: 2 });
      expect(checks.map((c) => c.label)).not.toContain(
        'Bài kiểm tra cuối khóa đã xuất bản',
      );
    });

    it.each([
      ['a closed exam', 'CLOSED', 'RANDOM_POOL'],
      ['a draft exam the author filled by hand', 'DRAFT', 'FIXED'],
    ] as const)('still blocks %s', (_, status, selectionMode) => {
      const chosen = { ...toDraftValue(eod), finalQuizId: '2' };
      const checks = draftChecks(chosen, [{ id: 2, status, selectionMode }]);

      expect(
        checks.find((c) => c.label === 'Bài kiểm tra cuối khóa đã xuất bản'),
      ).toMatchObject({ ok: false, step: 2 });
    });
  });

  describe('a course that is not stored yet', () => {
    it('starts empty, as a mandatory course', () => {
      const value = emptyDraftValue();

      expect(value).toMatchObject({
        title: '',
        programId: '',
        level: '',
        defaultRequirement: 'mandatory',
        rewardPoints: 0,
        chapters: [],
        objectives: [],
      });
      expect(emptyDraftValue()).not.toBe(value);
    });

    it('builds the create command with the code, the owner and the whole draft', () => {
      const value = toDraftValue(eod);
      const command = toCreateCourseCommand(value, '  WIZ-1 ', 4);

      expect(CreateCourseCommandSchema.safeParse(command).success).toBe(true);
      expect(command.ownerOrgId).toBe(4);
      expect(command.code).toBe('WIZ-1');
      expect(command.draft).toEqual(
        expect.objectContaining({
          title: value.title,
          objectives: eod.objectives.map((o) => o.description),
        }),
      );
    });

    it('spells the tree the way a save does', () => {
      const value = toDraftValue(eod);
      const { expectedVersion: _version, ...saved } = toSaveDraftCommand(
        value,
        0,
      );

      expect(toCreateCourseCommand(value, 'X', 1).draft).toEqual(saved);
    });

    it('sends an empty draft as just the required fields', () => {
      const { draft } = toCreateCourseCommand(emptyDraftValue(), 'X', 1);

      expect(draft).toEqual({
        defaultRequirement: 'mandatory',
        objectives: [],
        rewardPoints: 0,
        chapters: [],
      });
    });
  });
});

describe('mergeLive', () => {
  const eod = courseDetailFixtures.find((d) => d.course.code === 'VH-301')!;
  const saved = toDraftValue(eod);
  const lessonAt = (value: CourseDraftValue, chapter: number, lesson: number) =>
    value.chapters[chapter].lessons[lesson];
  const retitled = (
    value: CourseDraftValue,
    chapter: number,
    lesson: number,
    title: string,
  ): CourseDraftValue => ({
    ...value,
    chapters: value.chapters.map((c, ci) =>
      ci === chapter
        ? {
            ...c,
            lessons: c.lessons.map((l, li) =>
              li === lesson ? { ...l, title } : l,
            ),
          }
        : c,
    ),
  });

  it('takes the server draft when the author changed nothing', () => {
    const fresh = retitled(toDraftValue(eod), 0, 0, 'AI vừa viết');

    expect(mergeLive(saved, toDraftValue(eod), fresh)).toBe(fresh);
  });

  it('keeps a lesson the author edited and takes the others from the server', () => {
    const form = retitled(toDraftValue(eod), 0, 0, 'Bài tôi sửa');
    let fresh = retitled(toDraftValue(eod), 0, 0, 'AI ghi đè');
    fresh = retitled(fresh, 0, 1, 'AI vừa viết bài 2');

    const merged = mergeLive(saved, form, fresh);

    expect(lessonAt(merged, 0, 0).title).toBe('Bài tôi sửa');
    expect(lessonAt(merged, 0, 1).title).toBe('AI vừa viết bài 2');
  });

  it('keeps the whole form when the structure differs', () => {
    const form = {
      ...toDraftValue(eod),
      chapters: toDraftValue(eod).chapters.slice(1),
    };

    expect(mergeLive(saved, form, toDraftValue(eod))).toBe(form);
  });
});
