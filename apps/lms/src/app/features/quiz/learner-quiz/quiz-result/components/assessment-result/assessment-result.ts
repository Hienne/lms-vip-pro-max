import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { LearnerAttemptResult, LearnerSubmitType } from '@lms/contracts';
import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  Card,
  CardBody,
  CardHeader,
  FmtDatetimePipe,
  FmtScorePipe,
  Icon,
  OptionCard,
  PageHeader,
  Progress,
  type BreadcrumbItem,
} from '@lms/ui';

const AUTO_SUBMIT: readonly (LearnerSubmitType | null)[] = [
  'TIMEOUT',
  'QUIZ_CLOSED',
];

/**
 * The result of a graded attempt (the mockup's `quizResult`): the score, what to do next, the
 * per-competency breakdown and the review. The server decides pass or fail, the attempts left and
 * whether the review may be shown; this view only lays them out. The mockup's reward points and
 * certificate link are not in the backend's result, so they are left out.
 */
@Component({
  selector: 'app-assessment-result',
  imports: [
    Alert,
    Badge,
    Breadcrumb,
    Button,
    Card,
    CardBody,
    CardHeader,
    FmtDatetimePipe,
    FmtScorePipe,
    Icon,
    OptionCard,
    PageHeader,
    Progress,
    RouterLink,
  ],
  templateUrl: './assessment-result.html',
  styleUrl: './assessment-result.scss',
})
export class AssessmentResult {
  readonly result = input.required<LearnerAttemptResult>();
  readonly canRetry = input.required<boolean>();
  readonly reviewOpen = input(false);
  readonly reviewOpenChange = output<boolean>();

  protected readonly crumbs = computed((): readonly BreadcrumbItem[] => {
    const result = this.result();
    return [
      { label: result.quizTitle, href: `/quiz/${result.quizId}` },
      { label: `Kết quả lần ${result.attemptNo}` },
    ];
  });

  protected readonly autoSubmitted = computed(() =>
    AUTO_SUBMIT.includes(this.result().submitType),
  );

  protected readonly message = computed(() => {
    const { passed, summary } = this.result();
    if (passed) return 'Bài kiểm tra đã được ghi nhận vào tiến độ khóa học.';
    if (summary.passed)
      return 'Bạn đã đạt bài kiểm tra này ở một lượt thi khác. Lượt này chỉ để xem lại.';
    return summary.attemptsLeft > 0
      ? 'Xem lại nhóm kiến thức còn yếu bên dưới trước khi thi lại.'
      : 'Bạn đã dùng hết lượt thi. Giảng viên sẽ xem xét kết quả của bạn.';
  });

  protected readonly competencies = computed(() =>
    this.result().competencies.map((c) => ({
      ...c,
      percent: c.totalQuestions ? (c.correctCount / c.totalQuestions) * 100 : 0,
    })),
  );

  protected readonly suggestedReview = computed(() =>
    this.result().passed
      ? undefined
      : this.competencies()
          .filter(
            (group) =>
              group.totalQuestions > 0 &&
              group.correctCount < group.totalQuestions,
          )
          .sort((left, right) => left.percent - right.percent)[0],
  );

  protected readonly waitingUntil = computed(() => {
    const next = this.result().summary.nextAttemptAt;
    return this.canRetry() && next && Date.parse(next) > Date.now()
      ? next
      : null;
  });

  protected readonly reviewNote = computed(() => {
    const labels = {
      NEVER: 'Bài kiểm tra này không cho xem lại đáp án.',
      AFTER_SUBMIT: 'Bạn có thể xem lại đáp án ngay sau khi nộp.',
      AFTER_PASS: 'Đáp án chỉ mở khi bạn đã đạt bài kiểm tra.',
      AFTER_CLOSE: 'Đáp án mở sau khi bài kiểm tra đóng.',
    } as const;
    return labels[this.result().reviewPolicy];
  });
}
