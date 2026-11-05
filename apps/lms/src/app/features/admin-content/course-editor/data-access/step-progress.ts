/**
 * What the store needs to know about one wizard step's fields. The component builds it over the
 * form, so the store decides about steps without owning the form.
 */
export interface StepCheck {
  /** Whether a field of the step fails its validation. */
  readonly invalid: () => boolean;
  /** Whether the step's errors are shown, because a field was touched or the form submitted. */
  readonly touched: () => boolean;
  /** Marks the step's fields touched, so their errors show. */
  readonly touch: () => void;
}

/** The steps whose errors the author can see, for the "Còn thông tin chưa hợp lệ ở" alert. */
export function shownInvalidSteps(checks: readonly StepCheck[]): number[] {
  return checks.flatMap((check, step) =>
    check.touched() && check.invalid() ? [step] : [],
  );
}

/**
 * Which steps show ✓: visited, valid and not the current one. A step without a check (the
 * publish step) is never done, because only the publish itself completes it.
 */
export function completedSteps(
  count: number,
  checks: readonly StepCheck[],
  visited: readonly number[],
  current: number,
): boolean[] {
  return Array.from({ length: count }, (_, step) => {
    const check = checks[step];
    return (
      !!check && step !== current && visited.includes(step) && !check.invalid()
    );
  });
}
