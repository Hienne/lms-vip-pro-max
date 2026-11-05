import { Component, inject } from '@angular/core';
import {
  Alert,
  Button,
  Checkbox,
  DrawerOutlet,
  Dropzone,
  Icon,
  UploadItem,
} from '@lms/ui';
import { QuestionImportStore } from './data-access/question-import.store';

/**
 * The "Nhập từ Excel" drawer of the question bank: program, template, file, check, import. The
 * page renders it only while the import is open, so its store, and the picked file, go when it
 * closes.
 */
@Component({
  selector: 'app-question-import',
  imports: [Alert, Button, Checkbox, DrawerOutlet, Dropzone, Icon, UploadItem],
  providers: [QuestionImportStore],
  templateUrl: './question-import.html',
  styleUrl: './question-import.scss',
})
export class QuestionImport {
  protected readonly store = inject(QuestionImportStore);
}
