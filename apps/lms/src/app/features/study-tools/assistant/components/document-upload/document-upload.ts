import { Component, input, output } from '@angular/core';
import { Dropzone, Icon, IconButton, Spinner, UploadItem } from '@lms/ui';
import type { Upload } from '../../data-access/assistant.model';
import { UPLOAD_ACCEPT } from '../../data-access/upload-rules';

/** Where files are added, and the files that have not made it into the list yet. */
@Component({
  selector: 'app-document-upload',
  imports: [Dropzone, Icon, IconButton, Spinner, UploadItem],
  templateUrl: './document-upload.html',
  styleUrl: './document-upload.scss',
})
export class DocumentUpload {
  readonly uploads = input.required<readonly Upload[]>();
  readonly files = output<File[]>();
  readonly dismiss = output<number>();

  protected readonly accept = UPLOAD_ACCEPT;
}
