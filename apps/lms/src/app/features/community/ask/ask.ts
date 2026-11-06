import { Component, computed, effect, inject, signal } from '@angular/core';
import { form, FormField, FormRoot } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { COMMUNITY_LIMITS } from '@lms/contracts';
import {
  Badge,
  Breadcrumb,
  Button,
  Card,
  CardBody,
  Field,
  FmtNumPipe,
  FmtRelativePipe,
  Icon,
  IconButton,
  Input,
  PageHeader,
  Textarea,
} from '@lms/ui';
import type { HasUnsavedChanges } from '../../../core/routing/unsaved-changes.guard';
import { CoverPicker } from '../components/cover-picker/cover-picker';
import { MarkdownEditor } from '../components/markdown-editor/markdown-editor';
import { TagPicker } from '../components/tag-picker/tag-picker';
import { RESOLUTION_LABELS } from '../data-access/community-labels';
import { CommunityTagOptions } from '../data-access/community-tag-options';
import { ContentAuthoring } from '../data-access/content-authoring';
import {
  emptyContentForm,
  publishRules,
  toDraftFields,
} from '../data-access/content-form';
import { AskStore } from './data-access/ask.store';

/** Đặt câu hỏi (CM-02): a question draft, with similar questions shown while the title is typed. */
@Component({
  selector: 'app-community-ask',
  imports: [
    CoverPicker,
    Badge,
    Breadcrumb,
    Button,
    Card,
    CardBody,
    Field,
    FmtNumPipe,
    FmtRelativePipe,
    FormField,
    FormRoot,
    Icon,
    IconButton,
    Input,
    MarkdownEditor,
    PageHeader,
    RouterLink,
    TagPicker,
    Textarea,
  ],
  providers: [AskStore, ContentAuthoring, CommunityTagOptions],
  templateUrl: './ask.html',
  styleUrl: './ask.scss',
})
export class CommunityAsk implements HasUnsavedChanges {
  protected readonly store = inject(AskStore);
  protected readonly cover = this.store.cover;
  protected readonly hasCover = computed(() => !!this.cover.selection$());
  protected readonly tags = inject(CommunityTagOptions);
  protected readonly resolutionLabels = RESOLUTION_LABELS;
  protected readonly maxTechnologies = COMMUNITY_LIMITS.technologies.max;

  private readonly model = signal(emptyContentForm());
  protected readonly askForm = form(
    this.model,
    (path) => publishRules(path, { tags: true, lesson: false }),
    {
      submission: {
        action: async () =>
          this.store.publish(
            toDraftFields(this.model(), { cover: this.cover.selection$() }),
            this.model().tagIds,
          ),
      },
    },
  );

  constructor() {
    // Similar questions follow the title as it is typed.
    effect(() => this.store.typeTitle(this.model().title));
  }

  protected saveDraft(): void {
    this.store.saveDraft(
      toDraftFields(this.model(), { cover: this.cover.selection$() }),
      this.model().tagIds,
    );
  }

  protected setTags(tagIds: number[]): void {
    this.askForm.tagIds().value.set(tagIds);
    this.askForm.tagIds().markAsTouched();
  }

  protected addTechnology(): void {
    this.model.update((value) => ({
      ...value,
      technologies: [...value.technologies, { name: '', version: '' }],
    }));
  }

  protected removeTechnology(index: number): void {
    this.model.update((value) => ({
      ...value,
      technologies: value.technologies.filter((_, i) => i !== index),
    }));
  }

  hasUnsavedChanges(): boolean {
    const value = this.model();
    return (
      !this.store.done$() &&
      !!(
        value.title.trim() ||
        value.bodyMarkdown.trim() ||
        value.tagIds.length ||
        this.hasCover()
      )
    );
  }
}
