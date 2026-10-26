import { Component, computed, input, output } from '@angular/core';
import { Alert, AlertAction, Button } from '@lms/ui';
import type { StudyPhase } from '../../data-access/study-channel';

interface AlertView {
  readonly heading: string;
  readonly fallback: string;
  readonly action: 'takeOver' | 'reload' | 'retry';
  readonly label: string;
}

const VIEWS: Partial<Record<StudyPhase, AlertView>> = {
  takeover: {
    heading: 'Bài học đang mở ở nơi khác',
    fallback: 'Tài khoản của bạn đang học trên một thiết bị khác.',
    action: 'takeOver',
    label: 'Học trên thiết bị này',
  },
  moved: {
    heading: 'Bài học đã chuyển sang thiết bị khác.',
    fallback: 'Tiến độ không được lưu từ thiết bị này nữa.',
    action: 'takeOver',
    label: 'Học trên thiết bị này',
  },
  'media-changed': {
    heading: 'Nội dung bài đã thay đổi.',
    fallback: 'Tải lại bài để học bản mới nhất.',
    action: 'reload',
    label: 'Tải lại bài',
  },
  failed: {
    heading: 'Chưa kết nối được phiên học.',
    fallback: 'Kiểm tra kết nối và thử lại.',
    action: 'retry',
    label: 'Thử lại',
  },
};

/**
 * What the player says when the study session cannot carry on: another device has it, it moved,
 * the content changed, or it could not be claimed. Nothing else is shown for these: the one
 * button is the way on, and a takeover happens only on that click.
 */
@Component({
  selector: 'app-session-alert',
  imports: [Alert, AlertAction, Button],
  templateUrl: './session-alert.html',
})
export class SessionAlert {
  readonly phase = input.required<StudyPhase>();
  /** The server's message for the refusal, when it sent one. */
  readonly message = input<string | undefined>();

  readonly takeOver = output<void>();
  readonly reload = output<void>();
  readonly retry = output<void>();

  protected readonly view = computed(() => VIEWS[this.phase()]);

  protected act(action: AlertView['action']): void {
    if (action === 'takeOver') this.takeOver.emit();
    else if (action === 'reload') this.reload.emit();
    else this.retry.emit();
  }
}
