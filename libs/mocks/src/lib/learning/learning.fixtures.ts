import type {
  BlockType,
  BusinessModule,
  CompletionMode,
  CourseDetail,
  CourseLevel,
  GroupDetail,
  Requirement,
  TrainingField,
  TrainingProgram,
} from '@lms/contracts';
import { SEED_TIME } from '../backend/seed';

// The training catalogue, courses, assignments and learning groups of lms-mockup/src/data/seed.js,
// in the backend's shapes. Ids are numbers; the mockup's string ids are kept in comments. All rows
// belong to the seed's only org (id 1).

const ORG = 1;
const stamp = { createTime: SEED_TIME, updateTime: SEED_TIME };

export const trainingFieldFixtures: readonly TrainingField[] = [
  { id: 1, code: 'NV', name: 'Nghiệp vụ Core Banking', sortNo: 1 },
  { id: 2, code: 'CN', name: 'Công nghệ & hạ tầng', sortNo: 2 },
  { id: 3, code: 'VH', name: 'Vận hành & quy trình', sortNo: 3 },
  { id: 4, code: 'HN', name: 'Hội nhập & văn hóa', sortNo: 4 },
].map((field) => ({
  ...field,
  ownerOrgId: ORG,
  description: null,
  status: 'published',
  rowVersion: 0,
  ...stamp,
}));

export const businessModuleFixtures: readonly BusinessModule[] = [
  { id: 1, fieldId: 1, code: 'TQ', name: 'Tổng quan' },
  { id: 2, fieldId: 1, code: 'CIF', name: 'Khách hàng (CIF)' },
  { id: 3, fieldId: 1, code: 'TG', name: 'Tiền gửi' },
  { id: 4, fieldId: 1, code: 'GD', name: 'Giao dịch & hạch toán' },
  { id: 5, fieldId: 3, code: 'EOD', name: 'Vận hành EOD' },
  { id: 6, fieldId: 3, code: 'CM', name: 'Quản lý thay đổi' },
  { id: 7, fieldId: 4, code: 'HN', name: 'Hội nhập' },
  { id: 8, fieldId: 2, code: 'ATTT', name: 'An toàn thông tin' },
].map((module, index) => ({
  ...module,
  status: 'published',
  sortNo: index + 1,
  rowVersion: 0,
  ...stamp,
}));

export const trainingProgramFixtures: readonly TrainingProgram[] = [
  {
    id: 1,
    fieldId: 4,
    code: 'HN-01',
    name: 'Hội nhập cán bộ mới',
    description: 'Lộ trình 30 ngày đầu cho cán bộ mới và cán bộ luân chuyển.',
    status: 'published',
  },
  {
    id: 2,
    fieldId: 1,
    code: 'NV-01',
    name: 'Nền tảng nghiệp vụ Core Banking',
    description: 'Kiến thức nền về kiến trúc, dữ liệu và giao dịch trên Core.',
    status: 'published',
  },
  {
    id: 3,
    fieldId: 3,
    code: 'VH-01',
    name: 'Vận hành hệ thống Core Banking',
    description: 'Quy trình vận hành, quản lý thay đổi và xử lý cuối ngày.',
    status: 'published',
  },
  {
    id: 4,
    fieldId: 2,
    code: 'CN-01',
    name: 'An toàn thông tin',
    description: 'Chuẩn an toàn thông tin cho cán bộ công nghệ.',
    status: 'draft',
  },
].map((program, index) => ({
  ...program,
  ownerOrgId: ORG,
  status: program.status as TrainingProgram['status'],
  sortNo: index + 1,
  copiedFromProgramId: null,
  rowVersion: 0,
  ...stamp,
}));

interface SeedLesson {
  readonly title: string;
  readonly minutes: number;
  readonly quiz?: boolean;
  readonly blocks?: readonly [BlockType, string][];
}

interface SeedCourse {
  readonly id: number;
  readonly code: string;
  readonly title: string;
  readonly programId: number;
  readonly moduleId: number;
  readonly level: CourseLevel;
  readonly requirement: Requirement;
  readonly published: boolean;
  readonly summary: string;
  readonly objectives: readonly string[];
  readonly rewardPoints: number;
  readonly coverIcon: string;
  readonly chapters: readonly {
    readonly title: string;
    readonly lessons: readonly SeedLesson[];
  }[];
}

const SEED_COURSES: readonly SeedCourse[] = [
  {
    id: 1, // c1
    code: 'NV-101',
    title: 'Tổng quan hệ thống Core Banking',
    programId: 2,
    moduleId: 1,
    level: 'basic',
    requirement: 'mandatory',
    published: true,
    summary:
      'Hiểu kiến trúc tổng thể, mô hình dữ liệu khách hàng và luồng giao dịch từ kênh đến hệ thống lõi.',
    objectives: [
      'Mô tả được các thành phần chính của hệ thống Core Banking',
      'Giải thích vai trò của mã CIF và hồ sơ khách hàng',
      'Theo dõi được luồng một giao dịch từ kênh đến sổ cái',
      'Nhận diện các điểm kiểm soát maker–checker',
    ],
    rewardPoints: 80,
    coverIcon: 'layers',
    chapters: [
      {
        title: 'Kiến trúc & dữ liệu',
        lessons: [
          {
            title: 'Kiến trúc tổng thể hệ thống Core Banking',
            minutes: 18,
            blocks: [
              ['video', 'Video bài giảng'],
              ['text', 'Tóm tắt'],
            ],
          },
          {
            title: 'Mô hình dữ liệu khách hàng (CIF)',
            minutes: 20,
            blocks: [['pdf', 'Tài liệu CIF']],
          },
        ],
      },
      {
        title: 'Giao dịch & kiểm tra',
        lessons: [
          {
            title: 'Luồng giao dịch từ kênh đến sổ cái',
            minutes: 15,
            blocks: [['process', 'Các bước xử lý giao dịch']],
          },
          {
            title: 'Kiểm tra cuối khóa: Tổng quan Core Banking',
            minutes: 15,
            quiz: true,
          },
        ],
      },
    ],
  },
  {
    id: 2, // c2
    code: 'VH-201',
    title: 'Quy trình quản lý thay đổi (Change Management)',
    programId: 3,
    moduleId: 6,
    level: 'intermediate',
    requirement: 'mandatory',
    published: true,
    summary:
      'Nắm vòng đời một yêu cầu thay đổi, vai trò CAB, kế hoạch rollback và rà soát sau triển khai.',
    objectives: [
      'Lập được một yêu cầu thay đổi đầy đủ',
      'Phân biệt thay đổi thường, chuẩn và khẩn cấp',
      'Xây dựng kế hoạch rollback',
    ],
    rewardPoints: 60,
    coverIcon: 'process',
    chapters: [
      {
        title: 'Vòng đời thay đổi',
        lessons: [
          {
            title: 'Vòng đời một yêu cầu thay đổi',
            minutes: 14,
            blocks: [['video', 'Video bài giảng']],
          },
          {
            title: 'Phê duyệt thay đổi & CAB',
            minutes: 20,
            blocks: [
              ['pdf', 'Quy chế CAB'],
              ['attachment', 'Biểu mẫu yêu cầu thay đổi'],
            ],
          },
          { title: 'Kiểm tra: Quản lý thay đổi', minutes: 12, quiz: true },
        ],
      },
    ],
  },
  {
    id: 3, // c3
    code: 'VH-301',
    title: 'Vận hành cuối ngày (EOD/COB)',
    programId: 3,
    moduleId: 5,
    level: 'advanced',
    requirement: 'mandatory',
    published: true,
    summary:
      'Quy trình batch cuối ngày, kiểm tra trước EOD, giám sát và xử lý sự cố.',
    objectives: [
      'Thực hiện checklist trước EOD',
      'Giám sát tiến trình batch',
      'Xử lý sự cố EOD theo quy trình leo thang',
    ],
    rewardPoints: 100,
    coverIcon: 'clock',
    chapters: [
      {
        title: 'Batch cuối ngày',
        lessons: [
          {
            title: 'Tổng quan batch cuối ngày',
            minutes: 16,
            blocks: [['video', 'Video bài giảng']],
          },
          {
            title: 'Sổ tay xử lý sự cố EOD',
            minutes: 25,
            blocks: [
              ['pdf', 'Sổ tay sự cố'],
              ['process', 'Quy trình leo thang'],
            ],
          },
          { title: 'Kiểm tra: Vận hành EOD', minutes: 10, quiz: true },
        ],
      },
    ],
  },
  {
    id: 4, // c4
    code: 'HN-101',
    title: 'Văn hóa & quy chế làm việc tại Ban',
    programId: 1,
    moduleId: 7,
    level: 'basic',
    requirement: 'mandatory',
    published: true,
    summary:
      'Giới thiệu cơ cấu tổ chức, quy chế làm việc và các kênh hỗ trợ cho cán bộ mới.',
    objectives: [
      'Biết cơ cấu tổ chức và đầu mối liên hệ',
      'Nắm quy chế làm việc và bảo mật thông tin',
    ],
    rewardPoints: 40,
    coverIcon: 'building',
    chapters: [
      {
        title: 'Làm quen với Ban',
        lessons: [
          {
            title: 'Cơ cấu tổ chức & đầu mối hỗ trợ',
            minutes: 10,
            blocks: [['video', 'Giới thiệu Ban QL&PT Core Banking']],
          },
          {
            title: 'Quy chế làm việc & bảo mật',
            minutes: 12,
            blocks: [['text', 'Quy chế làm việc']],
          },
        ],
      },
    ],
  },
  {
    id: 5, // c5
    code: 'NV-102',
    title: 'Phân hệ Tiền gửi',
    programId: 2,
    moduleId: 3,
    level: 'intermediate',
    requirement: 'optional',
    published: true,
    summary:
      'Sản phẩm tiền gửi, tham số lãi suất và vòng đời tài khoản tiền gửi trên Core.',
    objectives: [
      'Hiểu tham số sản phẩm tiền gửi',
      'Theo dõi vòng đời tài khoản',
    ],
    rewardPoints: 50,
    coverIcon: 'database',
    chapters: [
      {
        title: 'Sản phẩm tiền gửi',
        lessons: [
          {
            title: 'Tham số sản phẩm tiền gửi',
            minutes: 15,
            blocks: [['pdf', 'Tham số tiền gửi']],
          },
          {
            title: 'Vòng đời tài khoản tiền gửi',
            minutes: 18,
            blocks: [['video', 'Vòng đời tài khoản tiền gửi']],
          },
        ],
      },
    ],
  },
  {
    id: 6, // c6
    code: 'CN-101',
    title: 'An toàn thông tin cho cán bộ CNTT',
    programId: 4,
    moduleId: 8,
    level: 'basic',
    requirement: 'optional',
    published: false,
    summary: 'Nguyên tắc an toàn thông tin khi làm việc với hệ thống lõi.',
    objectives: ['Áp dụng nguyên tắc quyền tối thiểu'],
    rewardPoints: 40,
    coverIcon: 'shield',
    chapters: [
      {
        title: 'Nguyên tắc cơ bản',
        lessons: [
          {
            title: 'Nguyên tắc quyền tối thiểu',
            minutes: 10,
            blocks: [['text', 'Nguyên tắc']],
          },
        ],
      },
    ],
  },
];

const COMPLETION: Record<BlockType, CompletionMode> = {
  video: 'video_coverage',
  pdf: 'pdf_end',
  text: 'manual',
  process: 'manual',
  image: 'open',
  attachment: 'open',
};

/** Builds one revision's tree; `ids` hands out the row ids, as the backend does on every save. */
function courseDetail(seed: SeedCourse, ids: () => number): CourseDetail {
  const revisionId = seed.id * 100;
  return {
    course: {
      id: seed.id,
      code: seed.code,
      ownerOrgId: ORG,
      ownerTeamId: null,
      ownerUserId: '000005',
      publishedRevisionId: seed.published ? revisionId : null,
      lifecycleStatus: 'active',
      copiedFromCourseId: null,
      rowVersion: 0,
      ...stamp,
    },
    revision: {
      id: revisionId,
      courseId: seed.id,
      revisionNo: 1,
      state: seed.published ? 'published' : 'draft',
      basedOnRevisionId: null,
      programId: seed.programId,
      moduleId: seed.moduleId,
      title: seed.title,
      summary: seed.summary,
      level: seed.level,
      defaultRequirement: seed.requirement,
      coverAssetId: null,
      coverIcon: seed.coverIcon,
      coverColor: null,
      publishedAt: seed.published ? SEED_TIME : null,
      publishedBy: seed.published ? '000005' : null,
      rowVersion: 0,
      ...stamp,
    },
    objectives: seed.objectives.map((description, index) => ({
      id: ids(),
      revisionId,
      description,
      sortNo: index + 1,
      rowVersion: 0,
      ...stamp,
    })),
    chapters: seed.chapters.map((chapter, chapterIndex) => {
      const chapterId = ids();
      return {
        chapter: {
          id: chapterId,
          revisionId,
          title: chapter.title,
          sortNo: chapterIndex + 1,
          sourceChapterId: null,
          rowVersion: 0,
          ...stamp,
        },
        lessons: chapter.lessons.map((lesson, lessonIndex) => {
          const lessonId = ids();
          return {
            lesson: {
              id: lessonId,
              chapterId,
              title: lesson.title,
              lessonType: lesson.quiz ? 'quiz' : 'content',
              estimatedDurationSeconds: lesson.minutes * 60,
              isRequired: true,
              sortNo: lessonIndex + 1,
              sourceLessonId: null,
              rowVersion: 0,
              ...stamp,
            },
            blocks: (lesson.blocks ?? []).map(([type, title], blockIndex) => {
              const blockId = ids();
              return {
                block: {
                  id: blockId,
                  lessonId,
                  blockType: type,
                  title,
                  body:
                    type === 'text' ? `## ${title}\n\nNội dung bài học.` : null,
                  bodyFormat: type === 'text' ? 'markdown' : null,
                  completionMode: COMPLETION[type],
                  completionThreshold: type === 'video' ? 80 : null,
                  isRequired: true,
                  sortNo: blockIndex + 1,
                  sourceBlockId: null,
                  rowVersion: 0,
                  ...stamp,
                },
                assets: [],
                steps:
                  type === 'process'
                    ? ['Tiếp nhận', 'Kiểm tra', 'Phê duyệt'].map(
                        (step, stepIndex) => ({
                          id: ids(),
                          blockId,
                          title: step,
                          description: null,
                          sortNo: stepIndex + 1,
                          rowVersion: 0,
                          ...stamp,
                        }),
                      )
                    : [],
              };
            }),
          };
        }),
      };
    }),
    completionRule: {
      id: revisionId,
      revisionId,
      requireAllRequiredLessons: true,
      rewardPoints: seed.rewardPoints,
      rowVersion: 0,
      ...stamp,
    },
  };
}

/** A fresh copy of the six seed courses; row ids start at `firstId`. */
export function seedCourseDetails(firstId = 1000): CourseDetail[] {
  let next = firstId;
  return SEED_COURSES.map((seed) => courseDetail(seed, () => next++));
}

/** The six seed courses with their content (a read-only copy for specs). */
export const courseDetailFixtures: readonly CourseDetail[] =
  seedCourseDetails();

/** What one learner has done in one course: the server's results. */
export interface LearnerCourseState {
  readonly courseId: number;
  readonly learningStatus:
    | 'not_started'
    | 'in_progress'
    | 'completed'
    | 'failed';
  readonly progressPercent: number;
  readonly dueInDays: number | null;
}

/**
 * The learners' standing per course (the mockup's seven states). `hocvien` (000004) is learning,
 * has failed one course and is overdue on another; `hocvien.tichhop` (000007) has just started.
 */
export const learnerCourseStateFixtures: Readonly<
  Record<string, readonly LearnerCourseState[]>
> = {
  '000004': [
    {
      courseId: 1,
      learningStatus: 'in_progress',
      progressPercent: 62,
      dueInDays: 12,
    },
    {
      courseId: 2,
      learningStatus: 'failed',
      progressPercent: 100,
      dueInDays: 18,
    },
    {
      courseId: 4,
      learningStatus: 'in_progress',
      progressPercent: 50,
      dueInDays: -2,
    },
    {
      courseId: 5,
      learningStatus: 'completed',
      progressPercent: 100,
      dueInDays: null,
    },
  ],
  '000007': [
    {
      courseId: 1,
      learningStatus: 'not_started',
      progressPercent: 0,
      dueInDays: 5,
    },
    {
      courseId: 4,
      learningStatus: 'in_progress',
      progressPercent: 20,
      dueInDays: 20,
    },
  ],
};

export const learningGroupFixtures: readonly GroupDetail[] = [
  {
    group: {
      id: 1,
      ownerOrgId: ORG,
      code: 'CBM-2026',
      name: 'Cán bộ mới 2026',
      description: 'Cán bộ vào Ban từ tháng 1/2026.',
      status: 'active',
      rowVersion: 0,
      ...stamp,
    },
    members: ['000004', '000007'].map((userId, index) => ({
      id: index + 1,
      groupId: 1,
      userId,
      joinedAt: SEED_TIME,
      leftAt: null,
      addedBy: '000002',
      rowVersion: 0,
      ...stamp,
    })),
  },
];
