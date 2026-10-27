import { courseDetailFixtures } from '@lms/mocks';
import {
  draftChecks,
  lessonProblem,
  newBlock,
  newLesson,
  toDraftValue,
  toSaveDraftCommand,
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

  it('flags a content lesson without blocks or without its file', () => {
    expect(lessonProblem(newLesson(1))).toBe('Thiếu nội dung');
    expect(
      lessonProblem({ ...newLesson(1), blocks: [newBlock('video')] }),
    ).toBe('Thiếu tệp');
    expect(
      lessonProblem({ ...newLesson(1), blocks: [newBlock('attachment')] }),
    ).toBeNull();
    expect(lessonProblem({ ...newLesson(1), lessonType: 'quiz' })).toBeNull();
  });

  it('lists what blocks publishing, the objectives being only advised', () => {
    const empty = { ...toDraftValue(eod), objectives: [], chapters: [] };
    const checks = draftChecks(empty);

    expect(checks.filter((c) => !c.ok).map((c) => c.label)).toEqual([
      'Có ít nhất 1 bài học',
      'Có mục tiêu đầu ra (khuyến nghị)',
    ]);
    expect(checks.find((c) => c.label.includes('mục tiêu'))?.optional).toBe(
      true,
    );
  });
});
