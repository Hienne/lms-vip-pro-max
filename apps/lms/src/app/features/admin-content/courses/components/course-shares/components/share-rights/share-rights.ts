import { Component, input, linkedSignal, output } from '@angular/core';
import { form, FormField, FormRoot } from '@angular/forms/signals';
import { Button, Switch } from '@lms/ui';
import type { ShareRights as Rights } from '../../data-access/course-shares.store';

/**
 * The three rights of a share as switches, with the button that saves them. It is the add form
 * below the unit picker and the inline edit of an active share; the owner decides what saving
 * does.
 */
@Component({
  selector: 'app-share-rights',
  imports: [Button, FormField, FormRoot, Switch],
  templateUrl: './share-rights.html',
  styleUrl: './share-rights.scss',
})
export class ShareRights {
  /** What the switches show first. */
  readonly initial = input.required<Rights>();
  readonly submitLabel = input.required<string>();
  /** Saving is not possible yet, such as before a unit is picked. */
  readonly blocked = input(false);
  readonly busy = input(false);

  readonly submitted = output<Rights>();
  readonly cancelled = output<void>();

  private readonly model = linkedSignal<Rights>(() => {
    const { includeDescendants, canAssign, canSelfEnroll } = this.initial();
    return { includeDescendants, canAssign, canSelfEnroll };
  });
  protected readonly rightsForm = form(this.model, {
    submission: {
      action: async () => this.submitted.emit({ ...this.model() }),
    },
  });
}
