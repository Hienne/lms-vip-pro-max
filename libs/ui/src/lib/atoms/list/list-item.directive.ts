import { Directive } from '@angular/core';

/**
 * One row of a `uiList`. Put it on the `<li>` for a plain row, or on an `<a>` / `<button>` inside
 * the `<li>` for an actionable row, which gets a hover background and keeps the focus ring:
 * `<li><a uiListItem href="/course/1"><span uiListIcon>…</span>Tên khóa học</a></li>`.
 */
@Directive({
  selector: 'li[uiListItem], a[uiListItem], button[uiListItem]',
  host: { class: 'list__item' },
})
export class ListItem {}
