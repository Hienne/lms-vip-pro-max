import { Component, computed, input, model, output } from '@angular/core';
import type { DocumentScope } from '@lms/contracts';
import {
  Button,
  Dropzone,
  Icon,
  IconButton,
  Input,
  Segmented,
  Spinner,
  UploadItem,
} from '@lms/ui';
import type { Upload } from '../../data-access/assistant.model';
import { scopeOptions } from '../../data-access/knowledge-status';
import { UPLOAD_ACCEPT } from '../../data-access/upload-rules';

/**
 * Where files are added, who may find them (asked before anything is sent), and the files that
 * have not made it into the list yet.
 */
@Component({
  selector: 'app-document-upload',
  imports: [
    Button,
    Dropzone,
    Icon,
    IconButton,
    Input,
    Segmented,
    Spinner,
    UploadItem,
  ],
  templateUrl: './document-upload.html',
  styleUrl: './document-upload.scss',
})
export class DocumentUpload {
  readonly uploads = input.required<readonly Upload[]>();
  /** Admins may also share a document with the whole system. */
  readonly canShareGlobally = input(false);
  readonly scope = model<DocumentScope>('unit');
  /** The name for the next file when one file is added; empty keeps the file name. */
  readonly title = model('');
  readonly files = output<File[]>();
  readonly dismiss = output<number>();
  /** The user asks to see the document an upload repeated. */
  readonly showExisting = output<number>();

  protected readonly accept = UPLOAD_ACCEPT;
  protected readonly scopes = computed(() =>
    scopeOptions(this.canShareGlobally()),
  );
}
