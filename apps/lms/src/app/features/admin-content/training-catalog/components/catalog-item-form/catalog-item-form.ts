import { Component, input, linkedSignal, output } from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  validateStandardSchema,
} from '@angular/forms/signals';
import type {
  BusinessModule,
  CatalogTreeField,
  CatalogTreeProgram,
} from '@lms/contracts';
import { Button, Field, Icon, Input, Select, Textarea } from '@lms/ui';
import type { SaveCatalogItem } from '../../data-access/training-catalog.store';
import {
  CatalogItemFormSchema,
  toCatalogItemFormValue,
} from './catalog-item-form.schema';

/**
 * The add/edit form of a field or a program (a program stays under the field it was added to). A
 * new row starts as a draft and an edited one keeps its status: publishing, pausing and archiving
 * are buttons on the detail panel. The submit button lives in the drawer footer and points here
 * by `form` id.
 */
@Component({
  selector: 'app-catalog-item-form',
  imports: [Button, Field, FormField, FormRoot, Icon, Input, Select, Textarea],
  templateUrl: './catalog-item-form.html',
})
export class CatalogItemForm {
  readonly kind = input.required<'field' | 'program'>();
  /** The row being edited; `null` adds a new one. */
  readonly item = input.required<
    CatalogTreeField | CatalogTreeProgram | null
  >();
  readonly submitted = output<SaveCatalogItem>();
  readonly modules = input<readonly BusinessModule[]>([]);

  private readonly model = linkedSignal(() =>
    toCatalogItemFormValue(
      this.item(),
      this.kind() === 'field' ? this.modules() : [],
    ),
  );
  protected readonly itemForm = form(
    this.model,
    (path) => validateStandardSchema(path, CatalogItemFormSchema),
    { submission: { action: async () => this.save() } },
  );

  private save(): void {
    const value = this.model();
    const description = value.description.trim();
    this.submitted.emit({
      code: value.code.trim(),
      name: value.name.trim(),
      status: this.item()?.status ?? 'draft',
      ...(description ? { description } : {}),
      ...(this.kind() === 'field'
        ? {
            modules: value.modules.map((module) => ({
              ...(module.id
                ? { id: module.id, expectedVersion: module.expectedVersion }
                : {}),
              code: module.code.trim(),
              name: module.name.trim(),
              status: module.status,
              sortNo: module.sortNo,
              deleted: module.deleted,
            })),
          }
        : {}),
    });
  }

  protected addModule(): void {
    this.model.update((value) => ({
      ...value,
      modules: [
        ...value.modules,
        {
          key: crypto.randomUUID(),
          code: '',
          name: '',
          status: 'published',
          sortNo: 0,
          deleted: false,
        },
      ],
    }));
  }

  protected removeModule(key: string): void {
    this.model.update((value) => ({
      ...value,
      modules: value.modules.flatMap((module) => {
        if (module.key !== key) return [module];
        if (!module.id) return [];
        const original = this.modules().find((row) => row.id === module.id);
        // A deleted row must not retain invalid hidden edits that would block the form.
        return [
          {
            ...module,
            code: original?.code ?? module.code,
            name: original?.name ?? module.name,
            status: original?.status ?? module.status,
            deleted: !module.deleted,
          },
        ];
      }),
    }));
  }
}
