import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Alert,
  Button,
  Empty,
  ErrorState,
  FmtDatetimePipe,
  Icon,
  PageHeader,
  Pagination,
  Search,
  SectionCard,
  Skeleton,
  Table,
  TableCell,
  TableCol,
  TablePrimary,
  TableWrap,
} from '@lms/ui';
import { SCORM_STATUS } from '../data-access/scorm-status';
import { ScormLibraryStore } from './data-access/scorm-library.store';

@Component({
  selector: 'app-scorm-library',
  imports: [
    Alert,
    Button,
    Empty,
    ErrorState,
    FmtDatetimePipe,
    Icon,
    PageHeader,
    Pagination,
    RouterLink,
    Search,
    SectionCard,
    Skeleton,
    Table,
    TableCell,
    TableCol,
    TablePrimary,
    TableWrap,
  ],
  providers: [ScormLibraryStore],
  templateUrl: './scorm-library.html',
  styleUrl: './scorm-library.scss',
})
export class ScormLibrary {
  protected readonly store = inject(ScormLibraryStore);
  protected readonly status = SCORM_STATUS;
  protected selected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.store.selectFile(input.files?.item(0) ?? null);
    input.value = '';
  }
  hasUnsavedChanges(): boolean {
    return this.store.uploading$();
  }
}
