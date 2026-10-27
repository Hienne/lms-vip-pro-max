import { Component, computed, input } from '@angular/core';
import type { ProcessStep } from '@lms/contracts';

/** A `process` block: the steps in order, number then title and description. */
@Component({
  selector: 'app-process-block',
  templateUrl: './process-block.html',
  styleUrl: './process-block.scss',
})
export class ProcessBlock {
  readonly steps = input.required<readonly ProcessStep[]>();

  protected readonly ordered = computed(() =>
    [...this.steps()].sort((a, b) => a.sortNo - b.sortNo),
  );
}
