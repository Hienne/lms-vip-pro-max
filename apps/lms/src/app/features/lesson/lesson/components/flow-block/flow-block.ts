import { Component, input } from '@angular/core';
import type { FlowModel } from '@lms/contracts';
import { FlowPlayer } from '../../../../../shared/flow/flow-player/flow-player';

/** A `flow` block in the lesson: the Mô phỏng luồng played back step by step. */
@Component({
  selector: 'app-flow-block',
  imports: [FlowPlayer],
  template: `<app-flow-player [flow]="flow()" />`,
})
export class FlowBlock {
  readonly flow = input.required<FlowModel>();
}
