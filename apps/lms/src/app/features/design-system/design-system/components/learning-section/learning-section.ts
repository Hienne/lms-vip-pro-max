import { Component, inject } from '@angular/core';
import { MaiBadge, Timer } from '@lms/ui';
import { QuestionGrid } from '../../../../../shared/quiz/question-grid';
import { QuestionLegend } from '../../../../../shared/quiz/question-legend';
import { DsDemo } from '../demo/demo';
import { DsSection } from '../section/section';
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

@Component({
  selector: 'app-learning-section',
  imports: [DsSection, DsDemo, MaiBadge, Timer, QuestionGrid, QuestionLegend],
  providers: [QuizDemoStore],
  templateUrl: './learning-section.html',
})
export class LearningSection {
  protected readonly quiz = inject(QuizDemoStore);
  protected readonly badges = BADGES;
}
