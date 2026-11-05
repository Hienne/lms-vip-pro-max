import { Component, computed, inject, input, output } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';
import type {
  BusinessModule,
  LibraryAsset,
  TrainingProgram,
} from '@lms/contracts';
import {
  Button,
  DrawerOutlet,
  Dropzone,
  Field,
  Icon,
  IconButton,
  Input,
  LinkButton,
  OptionCard,
  Select,
  Textarea,
  UploadItem,
} from '@lms/ui';
import {
  CourseCard,
  type CourseCardView,
} from '../../../../../shared/course/course-card';
import { LEVEL_LABEL } from '../../../../../shared/course/course-labels';
import { coverSrc } from '../../../../../shared/course/cover-image';
import { draftTotals, type CourseDraftValue } from '../../course-draft';
import {
  acceptOf,
  COVER_KEY,
  CourseEditorStore,
} from '../../data-access/course-editor.store';
import { isCancellable, itemState } from '../../data-access/upload-entry';
import { AssetLibrary } from '../asset-library/asset-library';
import { AssetLibraryStore } from '../asset-library/data-access/asset-library.store';

/**
 * Step 1 of the editor: the course's name, place in the catalogue, level, kind, summary and
 * learning objectives, beside a preview of the card learners will see with the cover image's
 * controls under it. It edits the
 * page's form through the field tree it is given. The cover is uploaded by the store as soon as it
 * is chosen (or picked from the library) and joins the draft once it is ready.
 */
@Component({
  selector: 'app-course-info',
  imports: [
    AssetLibrary,
    Button,
    CourseCard,
    DrawerOutlet,
    Dropzone,
    Field,
    FormField,
    Icon,
    IconButton,
    Input,
    LinkButton,
    OptionCard,
    Select,
    Textarea,
    UploadItem,
  ],
  providers: [AssetLibraryStore],
  templateUrl: './course-info.html',
  styleUrl: './course-info.scss',
})
export class CourseInfo {
  readonly draft = input.required<FieldTree<CourseDraftValue>>();
  /** A course being created: its code is typed here, and the owner is shown beside it. */
  readonly create = input(false);
  /** False on a published revision: the objectives cannot be added or removed. */
  readonly editable = input(true);
  readonly ownerName = input('');
  readonly programs = input.required<readonly TrainingProgram[]>();
  readonly modules = input.required<readonly BusinessModule[]>();
  /** The cover the draft will be saved with: the stored one, or the one chosen in this page. */
  readonly coverAssetId = input<number | null>(null);
  /** The chosen program, so the page lists the modules of its field. */
  readonly programPicked = output<string>();
  /** "Gỡ ảnh bìa": the page clears the cover from the draft. */
  readonly coverRemoved = output<void>();

  protected readonly store = inject(CourseEditorStore);
  protected readonly library = inject(AssetLibraryStore);
  protected readonly levels = Object.entries(LEVEL_LABEL);
  protected readonly accept = acceptOf('image');
  protected readonly coverKey = COVER_KEY;
  protected readonly itemState = itemState;
  protected readonly isCancellable = isCancellable;

  protected readonly cover = this.store.coverPreview(() => this.coverAssetId());
  protected readonly coverSrc = computed(() => coverSrc(this.cover()));

  /** The cover upload while it is on its way or refused; a finished one shows as the image. */
  protected readonly coverUpload = computed(() => {
    const entry = this.store.uploads$()[COVER_KEY];
    return entry && entry.state !== 'done' ? entry : undefined;
  });

  protected readonly preview = computed((): CourseCardView => {
    const value = this.draft()().value();
    const totals = draftTotals(value);
    const program = this.programs().find(
      (p) => String(p.id) === value.programId,
    );
    const module = this.modules().find((m) => String(m.id) === value.moduleId);
    return {
      id: 'preview',
      title: value.title.trim() || 'Tên khóa học',
      required: value.defaultRequirement === 'mandatory',
      domain: program?.name ?? 'Chương trình',
      module: module?.name ?? value.code,
      minutes: totals.minutes,
      lessons: totals.lessons,
      level: value.level ? LEVEL_LABEL[value.level] : '',
      pct: 0,
      status: 'not_started',
      statusLabel: 'Chưa bắt đầu',
      link: '.',
      coverUrl: this.coverSrc(),
    };
  });

  protected addObjective(): void {
    this.draft()
      .objectives()
      .value.update((list) => [...list, '']);
  }

  protected removeObjective(index: number): void {
    this.draft()
      .objectives()
      .value.update((list) => list.filter((_, i) => i !== index));
  }

  /** A file from the dropzone or the picker; the store checks it against the image rules. */
  protected chooseCover(files: readonly File[]): void {
    const file = files[0];
    if (file) this.store.uploadCover(file);
  }

  /** "Thay ảnh": the hidden input is emptied so the same file can be picked again. */
  protected pickedCover(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.chooseCover(Array.from(input.files ?? []));
    input.value = '';
  }

  protected openLibrary(): void {
    this.library.open(COVER_KEY, 'image');
  }

  protected useLibraryAsset(asset: LibraryAsset): void {
    this.store.pickCover(asset);
    this.library.close();
  }
}
