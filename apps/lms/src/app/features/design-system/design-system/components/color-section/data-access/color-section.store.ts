import { computed, Injectable, signal } from '@angular/core';
import {
  COLOR_TOKEN_GROUPS,
  CONTRAST_PAIRS,
  type ColorToken,
} from './color-tokens';
import { contrastRatio, wcagGrade, type WcagGrade } from './wcag-contrast';

export interface SwatchView extends ColorToken {
  /** Live value of the token in the current theme, upper-cased (e.g. `#006B68`). */
  readonly value: string;
}

export interface ContrastRowView {
  readonly foreground: string;
  readonly background: string;
  readonly ratio: string;
  readonly grade: WcagGrade | 'pending';
  /** Text of the grade badge, e.g. `AA` or `Đạt 3:1 (UI)`. */
  readonly gradeLabel: string;
}

const GRADE_LABEL: Readonly<Record<WcagGrade, string>> = {
  AAA: 'AAA',
  AA: 'AA',
  ui: 'Đạt 3:1 (UI)',
  fail: 'Chưa đạt',
};

const ALL_TOKENS: readonly string[] = [
  ...new Set([
    ...COLOR_TOKEN_GROUPS.flatMap((group) =>
      group.tokens.map((token) => token.token),
    ),
    ...CONTRAST_PAIRS.flat(),
  ]),
];

@Injectable()
export class ColorSectionStore {
  private readonly state = {
    tokenValues: signal<Readonly<Record<string, string>>>({}),
  };

  readonly tokenValues$ = this.state.tokenValues.asReadonly();

  readonly swatchGroups$ = computed(() =>
    COLOR_TOKEN_GROUPS.map(({ group, tokens }) => ({
      group,
      tokens: tokens.map(
        (token): SwatchView => ({
          ...token,
          value: this.tokenValues$()[token.token] ?? '',
        }),
      ),
    })),
  );

  readonly contrastRows$ = computed(() =>
    CONTRAST_PAIRS.map(([foreground, background]): ContrastRowView => {
      const values = this.tokenValues$();
      const ratio = contrastRatio(
        values[foreground] ?? '',
        values[background] ?? '',
      );
      if (ratio === undefined) {
        return {
          foreground,
          background,
          ratio: '…',
          grade: 'pending',
          gradeLabel: '…',
        };
      }
      const grade = wcagGrade(ratio, foreground.includes('border'));
      return {
        foreground,
        background,
        ratio: `${ratio.toFixed(2)}:1`,
        grade,
        gradeLabel: GRADE_LABEL[grade],
      };
    }),
  );

  setTokenValues(values: Readonly<Record<string, string>>): void {
    this.state.tokenValues.set(values);
  }

  /** Reads every token this section shows from the computed style of the document root. */
  readTokens(styles: Pick<CSSStyleDeclaration, 'getPropertyValue'>): void {
    this.setTokenValues(
      Object.fromEntries(
        ALL_TOKENS.map((token) => [
          token,
          styles.getPropertyValue(token).trim().toUpperCase(),
        ]),
      ),
    );
  }
}
