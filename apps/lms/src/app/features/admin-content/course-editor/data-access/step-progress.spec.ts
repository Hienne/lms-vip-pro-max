import { signal } from '@angular/core';
import { completedSteps, shownInvalidSteps, type StepCheck } from './step-progress';

/** A step check over plain signals, standing in for the form's fields. */
function fakeCheck(invalid: boolean, touched = false) {
  const state = { invalid: signal(invalid), touched: signal(touched) };
  const check: StepCheck = {
    invalid: () => state.invalid(),
    touched: () => state.touched(),
    touch: () => state.touched.set(true),
  };
  return { check, state };
}

describe('step progress', () => {
  describe('shownInvalidSteps', () => {
    it('lists only the steps whose errors the author has been shown', () => {
      const checks = [
        fakeCheck(true, true).check,
        fakeCheck(true, false).check,
        fakeCheck(false, true).check,
      ];
      expect(shownInvalidSteps(checks)).toEqual([0]);
    });

    it('lists a step once its fields are touched', () => {
      const step = fakeCheck(true);
      expect(shownInvalidSteps([step.check])).toEqual([]);
      step.check.touch();
      expect(shownInvalidSteps([step.check])).toEqual([0]);
    });
  });

  describe('completedSteps', () => {
    const steps = 4;

    it('completes a step that was visited, is valid and is not the current one', () => {
      const checks = [fakeCheck(false).check, fakeCheck(false).check, fakeCheck(false).check];
      expect(completedSteps(steps, checks, [0, 1], 1)).toEqual([true, false, false, false]);
    });

    it('does not complete a visited step with errors, touched or not', () => {
      const checks = [fakeCheck(true).check, fakeCheck(false).check, fakeCheck(false).check];
      expect(completedSteps(steps, checks, [0, 1], 1)).toEqual([false, false, false, false]);
    });

    it('does not complete a valid step that was never visited', () => {
      const checks = [fakeCheck(false).check, fakeCheck(false).check, fakeCheck(false).check];
      expect(completedSteps(steps, checks, [0], 0)).toEqual([false, false, false, false]);
    });

    it('never completes a step without a check (the publish step)', () => {
      const checks = [fakeCheck(false).check, fakeCheck(false).check, fakeCheck(false).check];
      expect(completedSteps(steps, checks, [0, 1, 2, 3], 0)).toEqual([false, true, true, false]);
    });

    it('drops the mark when the step becomes invalid', () => {
      const first = fakeCheck(false);
      const checks = [first.check, fakeCheck(false).check, fakeCheck(false).check];
      expect(completedSteps(steps, checks, [0, 1], 1)[0]).toBe(true);
      first.state.invalid.set(true);
      expect(completedSteps(steps, checks, [0, 1], 1)[0]).toBe(false);
    });
  });
});
