import { Component, computed, inject } from '@angular/core';
import { GuidedTour } from '@lms/ui';
import { UsageGuideStore } from './usage-guide.store';

@Component({
  selector: 'app-usage-guide',
  imports: [GuidedTour],
  template: `
    <ui-guided-tour
      [active]="store.shown$()"
      [welcome]="store.stage$() === 'welcome'"
      [title]="
        store.stage$() === 'welcome'
          ? 'Làm quen với Core Banking Academy'
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
    />
  `,
})
export class UsageGuide {
  protected readonly store = inject(UsageGuideStore);
  protected readonly welcome =
    'Chọn vai trò để xem cách học, soạn và giao khóa học, hoặc quản trị tổ chức, tài khoản và đào tạo. Mỗi bước đánh dấu vùng cần chú ý trên trang. Bạn có thể bỏ qua và mở lại từ menu tài khoản bất kỳ lúc nào.';
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
