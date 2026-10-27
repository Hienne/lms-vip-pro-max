import { Component, inject } from '@angular/core';
import { Button, ErrorState, FmtDatePipe, Icon, Menu, Spinner } from '@lms/ui';
import { OrgPicker } from './components/org-picker/org-picker';
import { ShareRights } from './components/share-rights/share-rights';
import {
  CourseSharesStore,
  type ShareRights as Rights,
} from './data-access/course-shares.store';

/**
 * The sharing of the course the list is showing (the mockup's `shareDialog`): the units it is
 * shared with and what each may do, the revoked ones, and a form to add a unit. Sharing lets a unit
 * use a course, never edit it.
 */
@Component({
  selector: 'app-course-shares',
  imports: [
    Button,
    ErrorState,
    FmtDatePipe,
    Icon,
    Menu,
    OrgPicker,
    ShareRights,
    Spinner,
  ],
  providers: [CourseSharesStore],
  templateUrl: './course-shares.html',
  styleUrl: './course-shares.scss',
})
export class CourseShares {
  protected readonly store = inject(CourseSharesStore);

  /** What a new share starts with: the unit may assign the course, nothing more. */
  protected readonly defaults: Rights = {
    includeDescendants: false,
    canAssign: true,
    canSelfEnroll: false,
  };
}
