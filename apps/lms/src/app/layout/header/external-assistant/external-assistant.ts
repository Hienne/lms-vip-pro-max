import { Component, inject, signal } from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  validateStandardSchema,
} from '@angular/forms/signals';
import {
  Alert,
  Button,
  DrawerOutlet,
  Empty,
  ErrorState,
  Field,
  FmtDatePipe,
  FmtRelativePipe,
  Icon,
  IconButton,
  Input,
  List,
  ListItem,
  Select,
  Skeleton,
} from '@lms/ui';
import { z } from 'zod';
import { ExternalAssistantStore } from './external-assistant.store';

const CreateConnectionFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: 'Nhập tên kết nối.' })
    .max(100, { error: 'Tên tối đa 100 ký tự.' }),
  validDays: z.enum(['30', '90']),
});

const EMPTY_FORM = { name: '', validDays: '30' as '30' | '90' };

/**
 * The header's "Kết nối trợ lý ngoài" button and drawer: the author's connections, revoking one,
 * and creating one whose token and Claude Code command show once.
 */
@Component({
  selector: 'app-external-assistant',
  imports: [
    Alert,
    Button,
    DrawerOutlet,
    Empty,
    ErrorState,
    Field,
    FmtDatePipe,
    FmtRelativePipe,
    FormField,
    FormRoot,
    Icon,
    IconButton,
    Input,
    List,
    ListItem,
    Select,
    Skeleton,
  ],
  providers: [ExternalAssistantStore],
  templateUrl: './external-assistant.html',
  styleUrl: './external-assistant.scss',
})
export class ExternalAssistant {
  protected readonly store = inject(ExternalAssistantStore);

  private readonly model = signal({ ...EMPTY_FORM });
  protected readonly createForm = form(
    this.model,
    (path) => {
      validateStandardSchema(path, CreateConnectionFormSchema);
    },
    {
      submission: {
        action: async () => {
          const { name, validDays } = this.model();
          this.store.create({
            name: name.trim(),
            validDays: Number(validDays) as 30 | 90,
          });
        },
      },
    },
  );

  /** Back to the list after reading the token; the form starts empty again. */
  protected done(): void {
    this.createForm().reset({ ...EMPTY_FORM });
    this.store.doneWithToken();
  }

  protected close(): void {
    this.createForm().reset({ ...EMPTY_FORM });
    this.store.closePanel();
  }
}
