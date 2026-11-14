import { Component, computed, inject } from '@angular/core';
import { Button, GuidedTour, Switch } from '@lms/ui';
import { UsageGuideStore } from './usage-guide.store';

@Component({
  selector: 'app-usage-guide',
  imports: [Button, GuidedTour, Switch],
  template: `
    <ui-guided-tour
      [active]="store.shown$()"
      [welcome]="store.stage$() === 'welcome'"
      [title]="
        store.stage$() === 'welcome'
          ? store.mode$() === 'intro'
            ? 'Làm quen trong ' + store.total$() + ' bước'
            : 'Hướng dẫn sử dụng'
          : (store.step$()?.title ?? '')
      "
      [description]="
        store.stage$() === 'welcome' ? welcome : (store.step$()?.text ?? '')
      "
      [target]="store.stage$() === 'tour' ? (store.step$()?.target ?? '') : ''"
      [index]="store.index$()"
      [total]="store.total$()"
      [error]="store.error$()"
      [audience]="store.audience$()"
      [audiences]="audiences()"
      (audienceChanged)="choose($event)"
      (next)="store.next()"
      (previous)="store.back()"
      (dismissed)="store.skip()"
    >
      @if (store.stage$() === 'welcome') {
        <label class="row">
          <input
            uiSwitch
            type="checkbox"
            [checked]="store.autoEnabled$()"
            (change)="store.setAutoEnabled(autoGuide.checked)"
            #autoGuide
          />
          Tự giới thiệu khi dùng vai trò mới
        </label>
      }
      @if (store.mode$() !== 'full') {
        <button
          uiButton
          type="button"
          size="sm"
          variant="ghost"
          (click)="store.open()"
        >
          Xem toàn bộ hướng dẫn
        </button>
      }
    </ui-guided-tour>
  `,
})
export class UsageGuide {
  protected readonly store = inject(UsageGuideStore);
  protected readonly welcome =
    'Mỗi bước chỉ vùng cần chú ý. Có thể đóng bất kỳ lúc nào; bấm nút Hướng dẫn trên đầu trang để xem trợ giúp màn đang dùng, hoặc mở toàn bộ hướng dẫn từ menu tài khoản. Tùy chọn tự giới thiệu được lưu riêng cho tài khoản trên trình duyệt này.';
  protected readonly audiences = computed(() =>
    this.store.audiences$().map((value) => ({
      value,
      label:
        value === 'admin'
          ? 'Quản trị viên'
          : value === 'learner'
            ? 'Học viên'
            : 'Giảng viên',
    })),
  );
  protected choose(value: string): void {
    if (value === 'learner' || value === 'instructor' || value === 'admin')
      this.store.chooseAudience(value);
  }
}
