import { Component, computed, input, output, signal } from '@angular/core';
import {
  FEEDBACK_NOTE_MAX_LENGTH,
  type Feedback,
  type FeedbackReason,
  type RateAnswerCommand,
} from '@lms/contracts';
import { Button, Checkbox, Icon, IconButton, Textarea } from '@lms/ui';

/** The reasons a user can give for a thumbs-down, in the order they are offered. */
export const FEEDBACK_REASONS: readonly {
  readonly code: FeedbackReason;
  readonly label: string;
}[] = [
  { code: 'incorrect', label: 'Sai' },
  { code: 'irrelevant', label: 'Không liên quan' },
  { code: 'outdated', label: 'Lỗi thời' },
  { code: 'missing_source', label: 'Thiếu nguồn' },
  { code: 'other', label: 'Khác' },
];

/**
 * Two thumbs under a finished answer. A thumbs-up is sent at once; a thumbs-down opens a small
 * picker for the reason and an optional note. It shows what it is given (the server's saved
 * feedback) and says what the user chose; the owning store sends it and keeps the result, so the
 * choice survives a reload and can be changed.
 */
@Component({
  selector: 'app-answer-feedback',
  imports: [Button, Checkbox, Icon, IconButton, Textarea],
  templateUrl: './answer-feedback.html',
  styleUrl: './answer-feedback.scss',
})
export class AnswerFeedback {
  /** What the server saved for this answer; null until the user rates it. */
  readonly value = input<Feedback | null>(null);
  /** A rating is on its way: the controls wait. */
  readonly saving = input(false);
  /** The last attempt to save did not reach the server. */
  readonly failed = input(false);

  readonly rated = output<RateAnswerCommand>();

  protected readonly reasons = FEEDBACK_REASONS;
  protected readonly noteMax = FEEDBACK_NOTE_MAX_LENGTH;
  protected readonly picking = signal(false);
  protected readonly reason = signal<FeedbackReason | null>(null);
  /** The opt-in to send the turn to the development team; off unless the saved feedback says otherwise. */
  protected readonly share = signal(false);
  protected readonly helpful = computed(() => this.value()?.helpful === true);
  protected readonly unhelpful = computed(
    () => this.value()?.helpful === false,
  );

  protected thumbsUp(): void {
    this.picking.set(false);
    this.rated.emit({ helpful: true });
  }

  /** Opens the picker, showing the earlier choice when the user is changing it. */
  protected thumbsDown(): void {
    if (this.picking()) {
      this.picking.set(false);
      return;
    }
    this.reason.set(this.value()?.reasonCode ?? null);
    this.share.set(this.value()?.shared === true);
    this.picking.set(true);
  }

  protected choose(code: FeedbackReason): void {
    this.reason.update((current) => (current === code ? null : code));
  }

  protected send(note: string): void {
    const reasonCode = this.reason();
    const text = note.trim();
    this.picking.set(false);
    this.rated.emit({
      helpful: false,
      ...(reasonCode ? { reasonCode } : {}),
      ...(text ? { note: text } : {}),
      ...(this.share() ? { share: true } : {}),
    });
  }

  protected cancel(): void {
    this.picking.set(false);
  }
}
