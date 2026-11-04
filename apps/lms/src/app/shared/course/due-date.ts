import {
  booleanAttribute,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { NOW } from './now';

const DAY = 86_400_000;
const SOON_DAYS = 3;

type DueTone = 'muted' | 'warning' | 'danger';

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

/**
 * A deadline in words (the mockup's `UI.Due`): "Còn n ngày · date", "Còn n ngày" in warning from
 * three days out, "Quá hạn n ngày" in danger, or just "Hạn date" once the course is done. The
 * clock is the injected `NOW`.
 */
@Component({
  selector: 'app-due-date',
  template: `<span class="due-date" [class]="toneClass()">{{ text() }}</span>`,
  styleUrl: './due-date.scss',
})
export class DueDate {
  /** ISO date-time of the deadline. */
  readonly dueAt = input<string | null>();
  /** The course is finished: the deadline no longer matters. */
  readonly done = input(false, { transform: booleanAttribute });
  /** Omits the countdown's date suffix when the layout already shows the date. */
  readonly relativeOnly = input(false, { transform: booleanAttribute });

  private readonly now = inject(NOW);

  private readonly view = computed((): { text: string; tone: DueTone } => {
    const dueAt = this.dueAt();
    if (!dueAt) return { text: 'Không có hạn', tone: 'muted' };
    if (this.done()) return { text: `Hạn ${formatDate(dueAt)}`, tone: 'muted' };
    const days = Math.ceil((new Date(dueAt).getTime() - this.now()) / DAY);
    if (days < 0) return { text: `Quá hạn ${-days} ngày`, tone: 'danger' };
    if (days <= SOON_DAYS) return { text: `Còn ${days} ngày`, tone: 'warning' };
    const date = this.relativeOnly() ? '' : ` · ${formatDate(dueAt)}`;
    return { text: `Còn ${days} ngày${date}`, tone: 'muted' };
  });
  protected readonly text = computed(() => this.view().text);
  protected readonly toneClass = computed(
    () => `due-date--${this.view().tone}`,
  );
}
