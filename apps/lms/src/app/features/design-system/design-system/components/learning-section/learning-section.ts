import { Component, inject } from '@angular/core';
import { MaiBadge, Rating, Stars, Timer } from '@lms/ui';
import {
  CourseCard,
  type CourseCardView,
} from '../../../../../shared/course/course-card';
import {
  Journey,
  type JourneyStop,
} from '../../../../../shared/course/journey';
import { QuestionGrid } from '../../../../../shared/quiz/question-grid';
import { QuestionLegend } from '../../../../../shared/quiz/question-legend';
import { DsDemo } from '../demo/demo';
import { DsSection } from '../section/section';
import { LearningSectionStore } from './data-access/learning-section.store';
import { QuizDemoStore } from './data-access/quiz-demo.store';

/** Badges of the mockup's "Huy hiệu cánh mai" demo. */
const BADGES = [
  {
    name: 'Khởi đầu suôn sẻ',
    description: 'Hoàn thành khóa đầu tiên',
    earned: true,
  },
  { name: 'Chuỗi 7 ngày', description: 'Học liên tục 7 ngày', earned: true },
  { name: 'Điểm tuyệt đối', description: '100% một bài thi', earned: false },
  { name: 'Tốt nghiệp', description: 'Xong khóa bắt buộc', earned: false },
] as const;

const DAY = 86_400_000;
const inDays = (days: number): string =>
  new Date(Date.now() + days * DAY).toISOString();

/** The three sample courses of the mockup's design-system page. */
const COURSES: readonly CourseCardView[] = [
  {
    id: 'x1',
    title: 'Tổng quan hệ thống Core Banking',
    required: true,
    cover: 'layers',
    domain: 'Nghiệp vụ',
    module: 'Tổng quan',
    minutes: 68,
    lessons: 4,
    level: 'Cơ bản',
    pct: 62,
    status: 'in_progress',
    statusLabel: 'Đang học',
    dueAt: inDays(9),
    bestScore: 60,
    link: '/design-system',
  },
  {
    id: 'x2',
    title: 'Văn hóa & quy chế làm việc tại Ban',
    required: true,
    cover: 'building',
    domain: 'Hội nhập',
    module: 'Hội nhập',
    minutes: 22,
    lessons: 2,
    level: 'Cơ bản',
    pct: 100,
    status: 'completed',
    statusLabel: 'Đã hoàn thành',
    link: '/design-system',
  },
  {
    id: 'x3',
    title: 'Vận hành cuối ngày (EOD/COB)',
    required: true,
    cover: 'clock',
    domain: 'Vận hành',
    module: 'Vận hành EOD',
    minutes: 51,
    lessons: 3,
    level: 'Nâng cao',
    pct: 10,
    status: 'in_progress',
    statusLabel: 'Đang học',
    overdue: true,
    dueAt: inDays(-2),
    link: '/design-system',
  },
];

/** The four journey stops of the mockup. */
const JOURNEY: readonly JourneyStop[] = [
  { name: 'Hội nhập', pct: 100, courses: 1 },
  { name: 'Nền tảng nghiệp vụ', pct: 62, courses: 2 },
  { name: 'Vận hành hệ thống', pct: 10, courses: 2 },
  { name: 'An toàn thông tin', pct: 0, courses: 1 },
];

@Component({
  selector: 'app-learning-section',
  imports: [
    DsSection,
    DsDemo,
    MaiBadge,
    Stars,
    Rating,
    CourseCard,
    Journey,
    Timer,
    QuestionGrid,
    QuestionLegend,
  ],
  providers: [LearningSectionStore, QuizDemoStore],
  templateUrl: './learning-section.html',
})
export class LearningSection {
  protected readonly store = inject(LearningSectionStore);
  protected readonly quiz = inject(QuizDemoStore);
  protected readonly badges = BADGES;
  protected readonly courses = COURSES;
  protected readonly journeyStops = JOURNEY;
}
