import { computed, inject, Injectable, signal } from '@angular/core';
import { map } from 'rxjs';
import { scormEndpoints, type ScormPackage } from '@lms/contracts';
import { EndpointClient } from '../../../../../core/http/endpoint-client';
import { serverMutation } from '../../../../../core/data-access/server-mutation';

interface ImportLecture {
  readonly file: File;
  readonly ownerOrgId: number;
  readonly selected: (lecture: ScormPackage) => void;
}

/** An import belongs to the open lesson drawer and is cancelled when that drawer is destroyed. */
@Injectable()
export class LessonScormUploadStore {
  private readonly client = inject(EndpointClient);
  private readonly state = {
    libraryOpen: signal(false),
    fileError: signal(''),
    lecture: signal<ScormPackage | null>(null),
  };
  private readonly upload = serverMutation(
    (command: ImportLecture) =>
      this.client
        .call(scormEndpoints.upload, {
          query: { ownerOrgId: command.ownerOrgId },
          body: { file: command.file },
        })
        .pipe(map((lecture) => ({ lecture, selected: command.selected }))),
    {
      errors: 'alert',
      onSuccess: ({ lecture, selected }) => {
        this.setLecture(lecture);
        this.setLibraryOpen(false);
        selected(lecture);
      },
    },
  );
  readonly pending$ = this.upload.isPending;
  readonly libraryOpen$ = this.state.libraryOpen.asReadonly();
  readonly lecture$ = this.state.lecture.asReadonly();
  readonly error$ = computed(
    () => this.state.fileError() || this.upload.error()?.message || '',
  );
  setLibraryOpen(open: boolean): void {
    this.state.libraryOpen.set(open);
  }
  private setFileError(message: string): void {
    this.state.fileError.set(message);
  }
  private setLecture(lecture: ScormPackage): void {
    this.state.lecture.set(lecture);
  }
  import(
    file: File | undefined,
    ownerOrgId: number | undefined,
    selected: ImportLecture['selected'],
  ): void {
    if (!file || this.pending$()) return;
    this.setFileError('');
    this.upload.reset();
    if (
      !file.name.toLowerCase().endsWith('.zip') ||
      !file.size ||
      file.size > 100 * 1024 * 1024
    ) {
      this.setFileError('Chọn tệp ZIP không rỗng, tối đa 100 MB.');
      return;
    }
    if (!ownerOrgId) {
      this.setFileError(
        'Chọn đơn vị sở hữu trong thông tin khóa học trước khi tải bài giảng.',
      );
      return;
    }
    this.upload.run({ file, ownerOrgId, selected });
  }
}
