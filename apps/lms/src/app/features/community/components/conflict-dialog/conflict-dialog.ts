import type { Dialog } from '@angular/cdk/dialog';
import { confirm } from '@lms/ui';
import type { Observable } from 'rxjs';

/**
 * Tells the user their change was refused because someone else updated the content first
 * (`COMMUNITY-CONFLICT`). Emits `true` when they choose to reload, `false` when they close it.
 * Nothing is merged for them: the screen reloads the content on `true`.
 */
export function askAfterConflict(dialog: Dialog): Observable<boolean> {
  return confirm(dialog, {
    title: 'Nội dung đã được người khác cập nhật',
    message:
      'Thao tác của bạn chưa được lưu, để không ghi đè lên thay đổi vừa có. Tải lại để xem bản mới nhất, rồi làm lại nếu cần. Nếu bạn đã nhập nội dung dài, hãy sao chép nó trước khi tải lại.',
    confirmLabel: 'Tải lại',
    cancelLabel: 'Đóng',
  });
}
