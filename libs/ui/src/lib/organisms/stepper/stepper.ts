import { CdkStep, CdkStepHeader, CdkStepper } from '@angular/cdk/stepper';
import { Component, computed, input, model, output } from '@angular/core';
import { Icon } from '../../atoms/icon/icon';

export interface StepperItem {
  readonly label: string;
  readonly subtitle?: string;
  /**
   * Whether the step counts as done. Defaults to "before the current step"; set it to gate
   * `linear` navigation on the caller's own validation.
   */
  readonly completed?: boolean;
}

/**
 * Wizard progress (the mockup's `.stepper`), built on the CDK stepper: it owns step state, the
 * `linear` rule and arrow-key focus; the markup and look are ours. The current step carries
 * `aria-current="step"`, done steps show a check and say "Đã hoàn thành". `selectedIndex` is a
 * two-way model; it only changes when the CDK allows the move. The step content itself is the
 * page's: render the panel for `selectedIndex` next to the stepper. The headers drop the CDK's
 * `tab` role: they are buttons in a list, with no tablist or tabpanel to belong to.
 */
@Component({
  selector: 'ui-stepper',
  imports: [CdkStep, CdkStepHeader, CdkStepper, Icon],
  templateUrl: './stepper.html',
})
export class Stepper {
  readonly steps = input.required<readonly StepperItem[]>();
  /** Accessible name of the list, e.g. "Các bước tạo khóa học". */
  readonly label = input.required<string>();
  /** Blocks moving past a step that is not completed. */
  readonly linear = input(false);
  /** Let the host validate/save asynchronously before committing a requested step. */
  readonly controlled = input(false);
  readonly stepRequested = output<number>();
  readonly selectedIndex = model(0);
  readonly doneLabel = input('Đã hoàn thành');

  protected readonly items = computed(() => {
    const current = this.selectedIndex();
    return this.steps().map((step, index) => ({
      ...step,
      done: step.completed ?? index < current,
    }));
  });

  protected go(cdk: CdkStepper, index: number): void {
    if (this.controlled()) this.stepRequested.emit(index);
    else cdk.selectedIndex = index;
  }
}
