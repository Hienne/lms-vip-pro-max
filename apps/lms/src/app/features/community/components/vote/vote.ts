import { Component, computed, input, output } from '@angular/core';
import { Button, FmtNumPipe, Icon } from '@lms/ui';

export type VoteValue = -1 | 0 | 1;

/**
 * The score of a question, answer or article with up and down buttons. Pressing the button of the
 * current vote withdraws it (`0`). The parent sends the command and passes the new score back;
 * `canVote` comes from the server's capabilities, with `blockedReason` as its tooltip.
 */
@Component({
  selector: 'app-vote',
  imports: [Button, FmtNumPipe, Icon],
  templateUrl: './vote.html',
  styleUrl: './vote.scss',
})
export class Vote {
  readonly score = input.required<number>();

  readonly myVote = input<number>(0);
  readonly canVote = input(true);
  readonly busy = input(false);
  readonly blockedReason = input(
    'Bạn không thể bình chọn cho nội dung của chính mình',
  );
  readonly voted = output<VoteValue>();

  protected readonly upLabel = computed(() =>
    this.canVote() ? 'Hữu ích' : this.blockedReason(),
  );
  protected readonly downLabel = computed(() =>
    this.canVote() ? 'Không hữu ích' : this.blockedReason(),
  );

  protected cast(value: 1 | -1): void {
    if (!this.canVote() || this.busy()) return;
    this.voted.emit(this.myVote() === value ? 0 : value);
  }
}
