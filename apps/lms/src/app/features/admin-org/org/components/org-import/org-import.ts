import { CdkCopyToClipboard } from '@angular/cdk/clipboard';
import { Component, inject } from '@angular/core';
import {
  Button,
  DrawerOutlet,
  Dropzone,
  Icon,
  IconButton,
  UploadItem,
} from '@lms/ui';
import { OrgImportStore } from '../../data-access/org-import.store';

/**
 * The "Nhập từ tệp" drawer of the org screen: template, file, check, import. The page renders it
 * only while the import is open, so its store, and the picked file, go when it closes.
 */
@Component({
  selector: 'app-org-import',
  imports: [
    Button,
    CdkCopyToClipboard,
    DrawerOutlet,
    Dropzone,
    Icon,
    IconButton,
    UploadItem,
  ],
  providers: [OrgImportStore],
  templateUrl: './org-import.html',
  styleUrl: './org-import.scss',
})
export class OrgImport {
  protected readonly store = inject(OrgImportStore);
}
