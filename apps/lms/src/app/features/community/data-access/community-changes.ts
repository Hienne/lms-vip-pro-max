import { Injectable } from '@angular/core';
import { invalidation } from '../../../core/data-access/invalidation';

/**
 * Cross-route refresh signals of the community area. A store that changes something bumps the
 * token the other routes read from; it holds no content and decides nothing.
 */
@Injectable({ providedIn: 'root' })
export class CommunityChanges {
  /** A content was created, edited, published, voted on, closed or moved: lists reload. */
  readonly contents = invalidation();
  /** A bookmark was set or cleared ("Đã lưu" in My posts, the saved flag on the detail). */
  readonly saved = invalidation();
  /** A report was created, assigned or acted on. */
  readonly reports = invalidation();
  /** A moderator was appointed or revoked. */
  readonly moderators = invalidation();
}
