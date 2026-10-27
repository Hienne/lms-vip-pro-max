import { Injectable } from '@angular/core';
import { invalidation } from './invalidation';

/** Cross-route refresh signals; contains no learner data or business calculations. */
@Injectable({ providedIn: 'root' })
export class LearningChanges {
  readonly results = invalidation();
  readonly saved = invalidation();
  readonly notifications = invalidation();
}
