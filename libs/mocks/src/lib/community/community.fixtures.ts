// Seed data of the community fake backend, modelled on the backend's catalogue and demo SQL
// (`learning_hub_community_catalog.sql`, `learning_hub_community_demo.sql`): 12 tags, a few
// questions in each resolution state, answers, articles, lessons learned, comments and one open
// report. People are the seed users of `backend/seed.ts`. Counts, scores and resolution status are
// computed by `CommunityBackend` from these rows, never written here.

/** The organisation every seed row belongs to. */
export const COMMUNITY_ORG_ID = 1;

export interface SeedTag {
  readonly tagId: number;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly aliases: readonly string[];
}

export const communityTagFixtures: readonly SeedTag[] = [
  {
    tagId: 1,
    slug: 'spring-boot',
    name: 'Spring Boot',
    description: 'Ứng dụng Java Spring Boot.',
    aliases: ['springboot'],
  },
  {
    tagId: 2,
    slug: 'oracle',
    name: 'Oracle',
    description: 'Cơ sở dữ liệu Oracle.',
    aliases: [],
  },
  {
    tagId: 3,
    slug: 'angular',
    name: 'Angular',
    description: 'Giao diện Angular.',
    aliases: [],
  },
  {
    tagId: 4,
    slug: 'openshift',
    name: 'OpenShift',
    description: 'Nền tảng container OpenShift.',
    aliases: ['ocp'],
  },
  {
    tagId: 5,
    slug: 'kafka',
    name: 'Kafka',
    description: 'Hàng đợi sự kiện Kafka.',
    aliases: [],
  },
  {
    tagId: 6,
    slug: 'postgresql',
    name: 'PostgreSQL',
    description: 'Cơ sở dữ liệu PostgreSQL.',
    aliases: ['postgres'],
  },
  {
    tagId: 7,
    slug: 'jenkins',
    name: 'Jenkins',
    description: 'Pipeline CI/CD Jenkins.',
    aliases: [],
  },
  {
    tagId: 8,
    slug: 'eod',
    name: 'EOD',
    description: 'Xử lý cuối ngày.',
    aliases: ['end-of-day'],
  },
  {
    tagId: 9,
    slug: 'cif',
    name: 'CIF',
    description: 'Thông tin khách hàng.',
    aliases: [],
  },
  {
    tagId: 10,
    slug: 'bao-mat',
    name: 'Bảo mật',
    description: 'Bảo mật ứng dụng và dữ liệu.',
    aliases: [],
  },
  {
    tagId: 11,
    slug: 'hieu-nang',
    name: 'Hiệu năng',
    description: 'Tối ưu hiệu năng.',
    aliases: [],
  },
  {
    tagId: 12,
    slug: 'quy-trinh',
    name: 'Quy trình',
    description: 'Quy trình vận hành.',
    aliases: [],
  },
];

export interface SeedContent {
  readonly contentId: number;
  readonly kind: 'question' | 'answer' | 'article' | 'lesson_learned';
  readonly authorUserId: string;
  /** Answers: the question they answer. */
  readonly questionId?: number;
  readonly title: string;
  readonly bodyMarkdown: string;
  readonly summary?: string;
  readonly tagIds?: readonly number[];
  readonly publishedAt: string;
  readonly context?: Record<string, unknown>;
}

export const communityContentFixtures: readonly SeedContent[] = [
  {
    contentId: 101,
    kind: 'question',
    authorUserId: '000004',
    title: 'Oracle UCP báo timeout khi lấy connection',
    bodyMarkdown:
      '## Bối cảnh\nỨng dụng thử nghiệm gặp timeout khi lấy connection từ pool.\n\n## Đã thử\nKiểm tra cấu hình pool và kết nối database.\n\n```properties\noracle.ucp.maxPoolSize=20\n```',
    summary: 'Cần tìm nguyên nhân timeout connection pool.',
    tagIds: [1, 2],
    publishedAt: '2026-10-20T08:00:00Z',
    context: {
      technologies: [
        { name: 'Java', version: '17' },
        { name: 'Oracle UCP', version: '21c' },
      ],
      environment: 'dev',
    },
  },
  {
    contentId: 102,
    kind: 'answer',
    questionId: 101,
    authorUserId: '000005',
    title: 'Câu trả lời cho “Oracle UCP báo timeout khi lấy connection”',
    bodyMarkdown:
      'Tăng `maxPoolSize` chỉ che triệu chứng. Hãy kiểm tra connection bị giữ quá lâu:\n\n1. Bật `abandonedConnectionTimeout`.\n2. Tìm giao dịch không đóng trong `finally`.',
    publishedAt: '2026-10-20T09:30:00Z',
  },
  {
    contentId: 103,
    kind: 'answer',
    questionId: 101,
    authorUserId: '000007',
    title: 'Câu trả lời cho “Oracle UCP báo timeout khi lấy connection”',
    bodyMarkdown:
      'Có thể do firewall cắt kết nối rảnh. Thử đặt `validateConnectionOnBorrow=true`.',
    publishedAt: '2026-10-21T02:10:00Z',
  },
  {
    contentId: 104,
    kind: 'question',
    authorUserId: '000007',
    title: 'Job EOD chạy chậm hơn bình thường sau khi nâng cấp Kafka',
    bodyMarkdown:
      'Sau khi nâng Kafka lên bản mới, job EOD kéo dài thêm khoảng 40 phút. Chưa thấy lỗi trong log.',
    tagIds: [5, 8, 11],
    publishedAt: '2026-10-22T03:00:00Z',
  },
  {
    contentId: 105,
    kind: 'answer',
    questionId: 104,
    authorUserId: '000005',
    title:
      'Câu trả lời cho “Job EOD chạy chậm hơn bình thường sau khi nâng cấp Kafka”',
    bodyMarkdown:
      'So sánh cấu hình `fetch.min.bytes` và `max.poll.records` giữa hai phiên bản.',
    publishedAt: '2026-10-22T05:00:00Z',
  },
  {
    contentId: 106,
    kind: 'question',
    authorUserId: '000005',
    title: 'Làm sao rollback một bản build lỗi trên OpenShift?',
    bodyMarkdown:
      'Cần quy trình nhanh để quay về bản build trước khi release lỗi, không đụng tới cấu hình.',
    tagIds: [4, 7, 12],
    publishedAt: '2026-10-23T01:00:00Z',
  },
  {
    contentId: 107,
    kind: 'question',
    authorUserId: '000004',
    title: 'Có nên lưu số CIF dạng chuỗi hay số trong PostgreSQL?',
    bodyMarkdown:
      'Số CIF có thể bắt đầu bằng số 0. Cân nhắc kiểu dữ liệu để không mất số 0 đầu và vẫn index nhanh.',
    tagIds: [6, 9],
    publishedAt: '2026-10-24T07:00:00Z',
  },
  {
    contentId: 110,
    kind: 'article',
    authorUserId: '000005',
    title: 'Checklist trước khi release lên OpenShift',
    bodyMarkdown:
      '## Trước khi release\n- Kiểm tra **health probe**.\n- Xác nhận secret đã được tạo.\n\n## Sau khi release\nTheo dõi log trong 15 phút đầu.',
    summary: 'Các bước kiểm tra trước và sau khi release.',
    tagIds: [4, 12],
    publishedAt: '2026-10-18T02:00:00Z',
  },
  {
    contentId: 111,
    kind: 'article',
    authorUserId: '000003',
    title: 'Quy ước đặt tên API nội bộ',
    bodyMarkdown:
      'Dùng danh từ số nhiều cho tài nguyên, động từ chỉ khi hành động không thuộc CRUD.',
    tagIds: [1, 12],
    publishedAt: '2026-10-15T02:00:00Z',
  },
  {
    contentId: 120,
    kind: 'lesson_learned',
    authorUserId: '000005',
    title: 'Mất tin nhắn do commit offset sớm',
    bodyMarkdown: 'Ghi chú thêm: đã bổ sung cảnh báo lag consumer.',
    summary: 'Consumer commit offset trước khi xử lý xong.',
    tagIds: [5],
    publishedAt: '2026-10-12T02:00:00Z',
    context: {
      lessonLearned: {
        occurredOn: '2026-10-10',
        symptoms:
          'Một số giao dịch không được ghi nhận sau khi consumer khởi động lại.',
        rootCause:
          'Consumer commit offset trước khi xử lý xong nên tin nhắn đang xử lý bị bỏ qua.',
        resolution:
          'Chuyển sang commit thủ công sau khi ghi cơ sở dữ liệu thành công.',
        prevention:
          'Thêm kiểm thử khởi động lại consumer và cảnh báo lag trên bảng giám sát.',
      },
    },
  },
  {
    contentId: 121,
    kind: 'lesson_learned',
    authorUserId: '000007',
    title: 'Timeout hàng loạt do hết hạn chứng chỉ nội bộ',
    bodyMarkdown:
      'Danh sách chứng chỉ sắp hết hạn được đưa vào lịch kiểm tra hằng tuần.',
    tagIds: [10, 12],
    publishedAt: '2026-10-05T02:00:00Z',
    context: {
      lessonLearned: {
        occurredOn: '2026-10-03',
        symptoms: 'Nhiều dịch vụ báo lỗi bắt tay TLS vào đầu giờ sáng.',
        rootCause: 'Chứng chỉ nội bộ hết hạn mà không có cảnh báo trước.',
        resolution:
          'Cấp lại chứng chỉ và khởi động lại các dịch vụ bị ảnh hưởng.',
        prevention: 'Thêm cảnh báo trước 30 ngày và kiểm tra hằng tuần.',
      },
    },
  },
];

export interface SeedComment {
  readonly commentId: number;
  readonly contentId: number;
  readonly authorUserId: string;
  readonly parentCommentId?: number;
  readonly bodyMarkdown: string;
  readonly createTime: string;
}

export const communityCommentFixtures: readonly SeedComment[] = [
  {
    commentId: 1,
    contentId: 101,
    authorUserId: '000005',
    bodyMarkdown:
      'Bạn dùng UCP bản nào? @[Học viên tích hợp Demo](user:000007) cũng gặp lỗi tương tự.',
    createTime: '2026-10-20T08:30:00Z',
  },
  {
    commentId: 2,
    contentId: 101,
    authorUserId: '000004',
    parentCommentId: 1,
    bodyMarkdown: 'Bản 21c, chạy trên môi trường dev.',
    createTime: '2026-10-20T08:45:00Z',
  },
  {
    commentId: 3,
    contentId: 102,
    authorUserId: '000004',
    bodyMarkdown: 'Cảm ơn, đang kiểm tra `abandonedConnectionTimeout`.',
    createTime: '2026-10-20T10:00:00Z',
  },
];

/** Votes by content then user: +1 or -1. */
export const communityVoteFixtures: readonly {
  readonly contentId: number;
  readonly userId: string;
  readonly value: 1 | -1;
}[] = [
  { contentId: 101, userId: '000005', value: 1 },
  { contentId: 101, userId: '000007', value: 1 },
  { contentId: 102, userId: '000004', value: 1 },
  { contentId: 102, userId: '000007', value: 1 },
  { contentId: 103, userId: '000004', value: -1 },
  { contentId: 104, userId: '000004', value: 1 },
  { contentId: 110, userId: '000004', value: 1 },
];

export interface SeedReport {
  readonly reportId: number;
  readonly contentId?: number;
  readonly commentId?: number;
  readonly reasonCode: string;
  readonly description: string;
  readonly reporterUserId: string;
  readonly reportedAt: string;
}

export const communityReportFixtures: readonly SeedReport[] = [
  {
    reportId: 1,
    contentId: 103,
    reasonCode: 'incorrect',
    description:
      'Câu trả lời đề xuất bật kiểm tra kết nối nhưng không nói rõ ảnh hưởng hiệu năng.',
    reporterUserId: '000004',
    reportedAt: '2026-10-25T03:00:00Z',
  },
  {
    reportId: 2,
    commentId: 3,
    reasonCode: 'abuse',
    description: 'Bình luận không liên quan tới nội dung.',
    reporterUserId: '000007',
    reportedAt: '2026-10-26T04:00:00Z',
  },
];

/** The demo moderator's staff code (`seed.ts`); the grant is created by the platform admin. */
export const COMMUNITY_MODERATOR_USER_ID = '000008';

/** The reasons the report dialog offers; the server accepts any text up to 100 characters. */
export const COMMUNITY_REPORT_REASONS = [
  'spam',
  'incorrect',
  'outdated',
  'sensitive_data',
  'abuse',
] as const;
