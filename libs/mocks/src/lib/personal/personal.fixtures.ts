import type {
  Achievements,
  Certificate,
  PersonalNotification,
  SavedItem,
} from '@lms/contracts';
export const savedFixtures: SavedItem[] = [
  {
    id: 'n1',
    courseId: 'c1',
    courseTitle: 'Nghiệp vụ CIF',
    lessonId: 'ls2',
    lessonTitle: 'Thay đổi CCCD',
    anchor: { type: 'pdf', page: 5 },
    label: null,
    text: 'Đổi CCCD → cập nhật CIF',
    createdAt: '2026-10-19T02:00:00Z',
  },
  {
    id: 'bm1',
    courseId: 'c1',
    courseTitle: 'Nghiệp vụ CIF',
    lessonId: 'ls3',
    lessonTitle: 'Kiểm soát giao dịch',
    anchor: { type: 'video', seconds: 250 },
    label: 'Kiểm soát maker-checker',
    text: null,
    createdAt: '2026-10-18T02:00:00Z',
  },
];
export const certificateFixtures: Certificate[] = [
  {
    id: 'cert1',
    courseId: 'c1',
    courseCode: 'CIF',
    courseTitle: 'Nghiệp vụ CIF',
    userName: 'Nguyễn An (dữ liệu mẫu)',
    completedAt: '2026-10-18T08:00:00Z',
    score: 90,
    verificationCode: 'DEMO-CBA-CIF',
    issuedAt: '2026-10-18T08:00:10Z',
    fileName: 'DEMO-chung-nhan-CIF.pdf',
  },
];
export const achievementFixture: Achievements = {
  points: {
    total: 65,
    parts: { lessons: 10, quizzes: 30, courses: 0, streak: 25 },
  },
  streak: 3,
  badges: [
    {
      id: 'first',
      name: 'Khởi đầu suôn sẻ',
      description: 'Hoàn thành khóa học đầu tiên',
      earned: true,
      earnedAt: '2026-10-18T08:00:00Z',
      progress: { current: 1, target: 1, unit: 'course' },
    },
    {
      id: 'week',
      name: 'Bền bỉ mỗi ngày',
      description: 'Học liên tục 7 ngày',
      earned: false,
      earnedAt: null,
      progress: { current: 3, target: 7, unit: 'day' },
    },
  ],
  recentEvents: [
    {
      id: 'ev1',
      kind: 'quiz',
      label: 'Đạt bài kiểm tra CIF',
      at: '2026-10-18T08:00:00Z',
      points: 30,
    },
  ],
};
export const notificationFixtures: PersonalNotification[] = [
  {
    id: 'nt1',
    kind: 'due',
    text: 'Khóa Nghiệp vụ CIF sắp đến hạn.',
    target: { type: 'course', id: 'c1' },
    at: '2026-10-19T02:00:00Z',
    readAt: null,
    dueAt: '2026-10-22T10:00:00Z',
  },
  {
    id: 'nt2',
    kind: 'certificate',
    text: 'Chứng nhận hoàn thành đã được cấp.',
    target: { type: 'certificate', id: 'cert1' },
    at: '2026-10-18T08:00:10Z',
    readAt: null,
    dueAt: null,
  },
];

/** Small, structurally valid PDF fixture; never represents a real certificate. */
export function demoCertificatePdf(): Blob {
  const stream =
    'BT /F1 20 Tf 60 760 Td (DEMO - NOT A VALID CERTIFICATE) Tj 0 -40 Td /F1 12 Tf (Core Banking Academy - FE integration fixture) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const start = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => `${String(n).padStart(10, '0')} 00000 n \n`)
    .join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return new Blob([pdf], { type: 'application/pdf' });
}
