import {
  Component,
  computed,
  input,
  numberAttribute,
  output,
} from '@angular/core';
import { Icon } from '../../atoms/icon/icon';

/**
 * Page controls of a list (the mockup's `.pagination`): the range shown, and previous / numbered /
 * next buttons when there is more than one page. Stateless: the owner passes the 1-based `page`
 * and reacts to `pageChange`. A page past the end reads as the last one.
 */
@Component({
  selector: 'ui-pagination',
  imports: [Icon],
  host: { class: 'pagination' },
  template: `
    <span>Hiển thị {{ from() }}–{{ to() }} / {{ total() }}</span>
    @if (pages() > 1) {
      <nav class="pagination__pages" aria-label="Phân trang">
        <button
          type="button"
          aria-label="Trang trước"
          [disabled]="current() === 1"
          (click)="pageChange.emit(current() - 1)"
        >
          <ui-icon name="chevron-left" size="sm" />
        </button>
        @for (n of numbers(); track n) {
          <button
            type="button"
            [attr.aria-current]="n === current() ? 'page' : null"
            (click)="pageChange.emit(n)"
          >
            {{ n }}
          </button>
        }
        <button
          type="button"
          aria-label="Trang sau"
          [disabled]="current() === pages()"
          (click)="pageChange.emit(current() + 1)"
        >
          <ui-icon name="chevron-right" size="sm" />
        </button>
      </nav>
    }
  `,
})
export class Pagination {
  readonly total = input.required({ transform: numberAttribute });
  readonly page = input(1, { transform: numberAttribute });
  readonly pageSize = input(10, { transform: numberAttribute });
  readonly pageChange = output<number>();

  protected readonly pages = computed(() =>
    Math.max(1, Math.ceil(this.total() / this.pageSize())),
  );
  protected readonly current = computed(() =>
    Math.min(Math.max(1, this.page()), this.pages()),
  );
  protected readonly numbers = computed(() =>
    Array.from({ length: this.pages() }, (_, i) => i + 1),
  );
  protected readonly from = computed(() =>
    this.total() === 0 ? 0 : (this.current() - 1) * this.pageSize() + 1,
  );
  protected readonly to = computed(() =>
    Math.min(this.current() * this.pageSize(), this.total()),
  );
}
