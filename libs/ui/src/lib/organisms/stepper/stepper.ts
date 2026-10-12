import { CdkStep, CdkStepHeader, CdkStepper } from '@angular/cdk/stepper';
import { Component, input, model } from '@angular/core';
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
 * page's: render the panel for `selectedIndex` next to the stepper.
 */
@Component({
  selector: 'ui-stepper',
  imports: [CdkStep, CdkStepHeader, CdkStepper, Icon],
  template: `
    <div
      cdkStepper
      #cdk="cdkStepper"
      [linear]="linear()"
      [selectedIndex]="selectedIndex()"
      (selectedIndexChange)="selectedIndex.set($event)"
    >
      <ol class="stepper" [attr.aria-label]="label()">
        @for (step of steps(); track $index; let i = $index) {
          <li class="stepper__item">
            <button
              type="button"
              cdkStepHeader
              class="stepper__step"
              [class.is-done]="isDone(step, i)"
              [attr.aria-current]="cdk.selectedIndex === i ? 'step' : null"
              [attr.aria-disabled]="
                cdk.steps.get(i)?.isNavigable() === false ? 'true' : null
              "
              [attr.tabindex]="cdk._getFocusIndex() === i ? 0 : -1"
              (click)="go(cdk, i)"
              (keydown)="cdk._onKeydown($event)"
            >
              <span class="stepper__num">
                @if (isDone(step, i) && cdk.selectedIndex !== i) {
                  <ui-icon name="check" size="sm" />
                  <span class="sr-only">{{ doneLabel() }}</span>
                } @else {
                  {{ i + 1 }}
                }
              </span>
              <span class="stepper__text">
                <span class="stepper__title">{{ step.label }}</span>
                @if (step.subtitle) {
                  <span class="stepper__sub">{{ step.subtitle }}</span>
                }
              </span>
            </button>
          </li>
        }
      </ol>
      @for (step of steps(); track $index; let i = $index) {
        <cdk-step [label]="step.label" [completed]="isDone(step, i)" />
      }
    </div>
  `,
})
export class Stepper {
  readonly steps = input.required<readonly StepperItem[]>();
  /** Accessible name of the list, e.g. "Các bước tạo khóa học". */
  readonly label = input.required<string>();
  /** Blocks moving past a step that is not completed. */
  readonly linear = input(false);
  readonly selectedIndex = model(0);
  readonly doneLabel = input('Đã hoàn thành');

  protected isDone(step: StepperItem, index: number): boolean {
    return step.completed ?? index < this.selectedIndex();
  }

  protected go(cdk: CdkStepper, index: number): void {
    cdk.selectedIndex = index;
  }
}
