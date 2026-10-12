import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { createAppRoutes } from '../../../app.routes';
import { provideAppConfig } from '../../../core/config/app-config';
import { testAppConfig } from '../../../core/config/app-config.testing';
import {
  migrationEntry,
  type MigrationEntryId,
} from '../data-access/migration-registry';

/** Opens `/design-system` through the real routes and returns the rendered page. */
export async function openDesignSystem(devTools = true) {
  TestBed.configureTestingModule({
    providers: [
      provideAppConfig(testAppConfig({ devTools })),
      provideRouter(createAppRoutes({ devTools })),
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl('/design-system');
  TestBed.tick();
  await harness.fixture.whenStable();
  return {
    page: harness.routeNativeElement as HTMLElement,
    router: TestBed.inject(Router),
  };
}

/** The migration entry ids named by the "Chưa migrate" placeholders under `root`. */
export function placeholderIds(root: ParentNode): string[] {
  return Array.from(root.querySelectorAll('[data-placeholder] code')).map(
    (code) => code.textContent ?? '',
  );
}

/**
 * The ids whose placeholder visibility disagrees with the registry: a placeholder must be shown
 * exactly while the migration entry is not done. Expect `[]`. Independent per piece: landing one
 * piece never breaks the check for another.
 */
export function placeholderMismatches(
  root: ParentNode,
  ids: readonly MigrationEntryId[],
): string[] {
  const shown = placeholderIds(root);
  return ids.filter(
    (id) => shown.includes(id) !== (migrationEntry(id).status !== 'done'),
  );
}
