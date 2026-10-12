import { Component, inject } from '@angular/core';
import {
  Alert,
  AlertAction,
  Button,
  Card,
  Empty,
  ErrorState,
  Skeleton,
  Spinner,
  Tip,
  Toaster,
} from '@lms/ui';
import { DsDemo } from '../demo/demo';
import { DsSection } from '../section/section';
import { ConfirmDemo } from './components/confirm-demo/confirm-demo';
import { DrawerDemo } from './components/drawer-demo/drawer-demo';
import { MenuDemo } from './components/menu-demo/menu-demo';

@Component({
  selector: 'app-feedback-section',
  imports: [
    DsSection,
    DsDemo,
    Alert,
    AlertAction,
    Button,
    Card,
    Empty,
    ErrorState,
    Skeleton,
    Spinner,
    Tip,
    MenuDemo,
    ConfirmDemo,
    DrawerDemo,
  ],
  templateUrl: './feedback-section.html',
  styleUrl: './feedback-section.scss',
})
export class FeedbackSection {
  private readonly toaster = inject(Toaster);

  protected toastSuccess(): void {
    this.toaster.success('Đã lưu thay đổi', 'Thông báo mẫu từ Design System.');
  }
  protected toastError(): void {
    this.toaster.error('Không lưu được', 'Thông báo mẫu từ Design System.');
  }
  protected toastWarning(): void {
    this.toaster.warning('Sắp hết giờ', 'Thông báo mẫu từ Design System.');
  }
  protected toastInfo(): void {
    this.toaster.info('Tiến độ được lưu tự động');
  }
}
