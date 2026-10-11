import { booleanAttribute, Component, computed, input } from '@angular/core';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Up to two initials of a name: the first letters of its last two words, upper-cased
 * (`Nguyễn Ngọc Anh` → `NA`, `Đỗ Văn` → `ĐV`). Works on whole code points, so a
 * diacritic or a decomposed letter is never cut in half.
 */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  return words
    .slice(-2)
    .map((word) =>
      (Array.from(word.normalize('NFC'))[0] ?? '').toLocaleUpperCase('vi'),
    )
    .join('');
}

/**
 * A round avatar with initials. The name is its accessible name (an image to assistive
 * technology); the initials themselves are hidden from it. `top` adds the reward ring of a
 * top-ranked person.
 */
@Component({
  selector: 'ui-avatar',
  host: {
    class: 'avatar',
    '[class]': 'modifiers()',
    role: 'img',
    '[attr.aria-label]': 'name()',
  },
  template: `<span aria-hidden="true">{{ initials() }}</span>`,
})
export class Avatar {
  readonly name = input.required<string>();
  readonly size = input<AvatarSize>('md');
  readonly top = input(false, { transform: booleanAttribute });

  protected readonly initials = computed(() => initialsOf(this.name()));
  protected readonly modifiers = computed(() =>
    [
      this.size() === 'md' ? '' : `avatar--${this.size()}`,
      this.top() ? 'avatar--top' : '',
    ].filter(Boolean),
  );
}
