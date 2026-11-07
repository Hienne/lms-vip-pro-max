import { Component, inject, linkedSignal } from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  validateStandardSchema,
} from '@angular/forms/signals';
import { MAX_LEVELS } from '@lms/contracts';
import { Button, Field, Icon, IconButton, Input } from '@lms/ui';
import { GamificationAdminStore } from '../../data-access/gamification-admin.store';
import {
  ConfigFormSchema,
  toConfigCommand,
  toConfigFormValue,
} from './config-form.schema';

/**
 * The XP weights and the level ladder of the next version, started from the version in force. One save
 * adds one version for both. The server repeats every rule; the form shows the same messages early.
 */
@Component({
  selector: 'app-config-form',
  imports: [Button, Field, FormField, FormRoot, Icon, IconButton, Input],
  templateUrl: './config-form.html',
  styleUrl: './config-form.scss',
})
export class ConfigForm {
  protected readonly store = inject(GamificationAdminStore);
  protected readonly maxLevels = MAX_LEVELS;

  private readonly model = linkedSignal(() =>
    toConfigFormValue(this.store.config$()),
  );
  protected readonly configForm = form(
    this.model,
    (path) => {
      validateStandardSchema(path, ConfigFormSchema);
    },
    {
      submission: {
        action: async () => {
          this.store.saveConfig(toConfigCommand(this.model()));
        },
      },
    },
  );

  protected addLevel(): void {
    this.model.update((value) => {
      const last = value.levels.at(-1);
      const next = Number(last?.minXp ?? 0) + 100;
      return {
        ...value,
        levels: [
          ...value.levels,
          { name: '', minXp: String(Number.isFinite(next) ? next : 100) },
        ],
      };
    });
  }

  protected removeLevel(index: number): void {
    this.model.update((value) => ({
      ...value,
      levels: value.levels.filter((_, i) => i !== index),
    }));
  }
}
