import { Component, computed, input, output, signal } from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  validateStandardSchema,
} from '@angular/forms/signals';
import {
  FEEDBACK_MAX_LENGTH,
  ReplyFeedbackCommandSchema,
  type InstructorFeedbackView,
  type ReplyFeedbackCommand,
} from '@lms/contracts';
import {
  Badge,
  Button,
  Checkbox,
  Field,
  FmtRelativePipe,
  Textarea,
  type BadgeTone,
} from '@lms/ui';
import { z } from 'zod';
import { anchorText } from '../../../../shared/learning/anchor';

const ReplyFormSchema = z.object({
  reply: z
    .string()
    .trim()
    .min(1, { error: 'Nhập nội dung trả lời.' })
    .max(FEEDBACK_MAX_LENGTH, { error: 'Nội dung tối đa 1000 ký tự.' }),
  resolve: z.boolean(),
});

/** One question or report of a learner, with the instructor's answer or the form to write one. */
@Component({
  selector: 'app-instructor-feedback-item',
  imports: [
    Badge,
    Button,
    Checkbox,
    Field,
    FmtRelativePipe,
    FormField,
    FormRoot,
    Textarea,
  ],
  templateUrl: './instructor-feedback-item.html',
  styleUrl: './instructor-feedback-item.scss',
})
export class InstructorFeedbackItem {
  readonly item = input.required<InstructorFeedbackView>();
  readonly busy = input(false);
  readonly reply = output<ReplyFeedbackCommand>();

  protected readonly anchorText = anchorText;
  protected readonly editing = signal(false);

  protected readonly kindLabel = computed(() =>
    this.item().kind === 'question' ? 'Câu hỏi' : 'Báo nội dung',
  );

  protected readonly state = computed((): { text: string; tone: BadgeTone } => {
    const { status, kind } = this.item();
    if (status === 'new') return { text: 'Chưa trả lời', tone: 'warning' };
    return status === 'resolved'
      ? { text: 'Đã đóng', tone: 'success' }
      : {
          text: kind === 'question' ? 'Đã trả lời' : 'Đã xử lý',
          tone: 'success',
        };
  });

  private readonly model = signal({ reply: '', resolve: false });
  protected readonly replyForm = form(
    this.model,
    (path) => {
      validateStandardSchema(path, ReplyFormSchema);
    },
    {
      submission: {
        action: async () => {
          if (this.busy()) return;
          const command = ReplyFeedbackCommandSchema.parse({
            reply: this.model().reply,
            resolve: this.model().resolve,
          });
          this.reply.emit(command);
          this.editing.set(false);
          this.replyForm().reset({ reply: '', resolve: false });
        },
      },
    },
  );

  protected edit(): void {
    this.model.set({ reply: this.item().reply ?? '', resolve: false });
    this.editing.set(true);
  }
}
