import {
  TabList,
  Tab,
  TabPanel as AriaTabPanel,
  Tabs as AriaTabs,
} from '@angular/aria/tabs';
import {
  booleanAttribute,
  Component,
  Directive,
  input,
  model,
} from '@angular/core';
import { Icon } from '../../atoms/icon/icon';
import type { IconName } from '../../atoms/icon/icon-registry';

export interface TabItem {
  readonly id: string;
  readonly label: string;
  readonly icon?: IconName;
  /** Shown after the label and read as part of the tab name ("Khóa học 6"). */
  readonly count?: number;
}

/**
 * Tab list (the mockup's `UI.Tabs`), built on the `@angular/aria` tabs: roving tabindex, arrow
 * keys, Home and End move and select. `selected` is a two-way model holding the tab id; the
 * panels are `[uiTabPanel]` elements keyed by the same id.
 */
@Component({
  selector: 'ui-tabs',
  imports: [TabList, Tab, Icon],
  hostDirectives: [AriaTabs],
  template: `
    <div
      ngTabList
      class="tabs"
      [class.tabs--wrap]="wrap()"
      [class.tabs--compact]="compact()"
      selectionMode="follow"
      [attr.aria-label]="label()"
      [(selectedTab)]="selected"
    >
      @for (tab of tabs(); track tab.id) {
        <button type="button" ngTab class="tabs__tab" [value]="tab.id">
          @if (tab.icon) {
            <ui-icon [name]="tab.icon" size="sm" />
          }
          {{ tab.label }}
          @if (tab.count !== undefined) {
            <span class="tabs__count">{{ tab.count }}</span>
          }
        </button>
      }
    </div>
    <ng-content />
  `,
})
export class Tabs {
  readonly tabs = input.required<readonly TabItem[]>();
  /** Accessible name of the tab list, e.g. "Các mục". */
  readonly label = input.required<string>();
  readonly selected = model.required<string>();
  /** Wraps the tabs onto more rows instead of scrolling the strip; for a few tabs in a narrow column. */
  readonly wrap = input(false, { transform: booleanAttribute });
  /** Tighter spacing between and inside the tabs, so five or six fit on one line in a column of about 650px. */
  readonly compact = input(false, { transform: booleanAttribute });
}

/** The panel of the tab whose id is the attribute value, `<div uiTabPanel="courses">`; hidden and inert while that tab is not selected. */
@Directive({
  selector: '[uiTabPanel]',
  hostDirectives: [{ directive: AriaTabPanel, inputs: ['value: uiTabPanel'] }],
  host: { class: 'tabs__panel' },
})
export class TabPanel {}
