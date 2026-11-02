import {
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
  type WritableSignal,
} from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  validateStandardSchema,
} from '@angular/forms/signals';
import type {
  FeedbackKind,
  FeedbackStatus,
  FeedbackView,
  LessonCommentView,
  RatingSummary,
} from '@lms/contracts';
import {
  Badge,
  Button,
  ErrorState,
  Field,
  FmtRelativePipe,
  Rating,
  Skeleton,
  Stars,
  TabPanel,
  Tabs,
  Textarea,
  type BadgeTone,
} from '@lms/ui';
import { anchorText } from '../../../../../shared/learning/anchor';
import {
  FeedbackFormSchema,
  type FeedbackFormValue,
} from './lesson-feedback.form';

const KINDS: readonly FeedbackKind[] = ['comment', 'question', 'report'];

interface Copy {
  readonly label: string;
  readonly help: string;
  readonly button: string;
  readonly placeholder: string;
}

const COPY: Record<FeedbackKind, Copy> = {
  comment: {
    label: 'Nhận xét của bạn',
    help: 'Nhận xét hiển thị công khai cho học viên khác. Tối đa 1000 ký tự.',
    button: 'Gửi nhận xét',
    placeholder: '',
  },
  question: {
    label: 'Câu hỏi cho giảng viên',
    help: 'Chỉ bạn và giảng viên thấy câu hỏi này. Tối đa 1000 ký tự.',
    button: 'Gửi câu hỏi',
    placeholder: 'Câu hỏi sẽ được gửi kèm vị trí đang học…',
  },
  report: {
    label: 'Mô tả vấn đề (sai thông tin, lỗi tệp, nội dung nhạy cảm…)',
    help: 'Báo cáo được gửi riêng tới giảng viên/quản trị nội dung. Tối đa 1000 ký tự.',
    button: 'Gửi báo cáo',
    placeholder: '',
  },
};

interface StatusLabel {
  readonly text: string;
  readonly tone: BadgeTone;
}

/** A question waits for an answer; once the instructor moved it on, it is answered. */
const questionStatus = (status: FeedbackStatus | null): StatusLabel =>
  status === 'new' || status === null
    ? { text: 'Chờ trả lời', tone: 'warning' }
    : { text: 'Đã trả lời', tone: 'success' };

/** A report waits to be looked at; once the instructor moved it on, it is handled. */
const reportStatus = (status: FeedbackStatus | null): StatusLabel =>
  status === 'new' || status === null
    ? { text: 'Chờ xử lý', tone: 'warning' }
    : { text: 'Đã xử lý', tone: 'success' };

/**
 * "Đánh giá & trao đổi" under the lesson: the stars, then three tabs (comments, questions to the
 * instructor, reports), each with its own form and its own list. It owns the forms only; the data,
 * the commands and the confirm before a report are the store's.
 */
@Component({
  selector: 'app-lesson-feedback',
  imports: [
    Badge,
    Button,
    ErrorState,
    Field,
    FmtRelativePipe,
    FormField,
    FormRoot,
    Rating,
    Skeleton,
    Stars,
    TabPanel,
    Tabs,
    Textarea,
  ],
  templateUrl: './lesson-feedback.html',
  styleUrl: './lesson-feedback.scss',
})
export class LessonFeedback {
  /** The lesson on screen: a new one starts with empty forms on the comments tab. */
  readonly lessonId = input<number | undefined>(undefined);
  /** The lesson's average and count; null until someone rates. */
  readonly rating = input<RatingSummary | null>(null);
  /** The caller's stars, 0 for none yet. */
  readonly myStars = input(0);
  readonly comments = input.required<readonly LessonCommentView[]>();
  /** All the comments of the lesson, loaded or not. */
  readonly commentTotal = input(0);
  readonly hasMore = input(false);
  readonly moreBusy = input(false);
  readonly questions = input.required<readonly FeedbackView[]>();
  readonly reports = input.required<readonly FeedbackView[]>();
  readonly loading = input(false);
  readonly error = input<{ readonly message: string } | undefined>(undefined);
  readonly sending = input(false);
  /** Where a send goes, in words ("Trang 3", "Video 0:12"); null for the whole lesson. */
  readonly spot = input<string | null>(null);
  /** How many of each kind were sent: the form of a kind empties when its own count changes. */
  readonly sent = input<Partial<Record<FeedbackKind, number>>>({});

  readonly rate = output<number>();
  readonly send = output<{ kind: FeedbackKind; text: string }>();
  readonly more = output<void>();
  readonly retry = output<void>();

  protected readonly kinds = KINDS;
  protected readonly copy = COPY;
  protected readonly anchorText = anchorText;
  protected readonly questionStatus = questionStatus;
  protected readonly reportStatus = reportStatus;

  protected readonly tab = signal<string>('comment');
  protected readonly tabs = computed(() => [
    { id: 'comment', label: 'Nhận xét', count: this.commentTotal() },
    { id: 'question', label: 'Hỏi giảng viên', count: this.questions().length },
    { id: 'report', label: 'Báo nội dung không phù hợp' },
  ]);

  private readonly models: Record<
    FeedbackKind,
    WritableSignal<FeedbackFormValue>
  > = {
    comment: signal({ text: '' }),
    question: signal({ text: '' }),
    report: signal({ text: '' }),
  };
  protected readonly forms = {
    comment: this.makeForm('comment'),
    question: this.makeForm('question'),
    report: this.makeForm('report'),
  };

  private readonly seen: Record<FeedbackKind, number> = {
    comment: 0,
    question: 0,
    report: 0,
  };

  private lesson: number | undefined;

  /** A draft belongs to the lesson it was typed under: another lesson never inherits it. */
  private readonly startOverOnNewLesson = effect(() => {
    const id = this.lessonId();
    untracked(() => {
      if (id !== this.lesson && this.lesson !== undefined) {
        this.tab.set('comment');
        for (const kind of KINDS) this.forms[kind]().reset({ text: '' });
      }
      this.lesson = id;
    });
  });

  /** A sent form leaves an empty one that has not been touched, so no error shows before the next submit. */
  private readonly clearAfterSend = effect(() => {
    const sent = this.sent();
    untracked(() => {
      for (const kind of KINDS) {
        const count = sent[kind] ?? 0;
        if (count !== this.seen[kind]) {
          this.seen[kind] = count;
          this.forms[kind]().reset({ text: '' });
        }
      }
    });
  });

  private makeForm(kind: FeedbackKind) {
    return form(
      this.models[kind],
      (path) => {
        validateStandardSchema(path, FeedbackFormSchema);
      },
      {
        submission: {
          action: async () => {
            if (this.sending()) return;
            this.send.emit({ kind, text: this.models[kind]().text.trim() });
          },
        },
      },
    );
  }
}
