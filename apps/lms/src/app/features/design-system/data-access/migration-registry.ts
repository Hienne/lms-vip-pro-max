import {
  MIGRATION_ENTRIES,
  type MigrationEntryId,
} from './migration-entries.data';
import {
  MigrationRegistrySchema,
  type ComponentEntry,
  type MigrationEntry,
  type MigrationStatus,
  type RouteEntry,
} from './migration-entry.schema';

export type { MigrationEntryId } from './migration-entries.data';

/** The parsed registry. Parsing at load means a malformed entry fails every spec and the app start. */
export const MIGRATION_REGISTRY: readonly MigrationEntry[] =
  MigrationRegistrySchema.parse(MIGRATION_ENTRIES);

const BY_ID = new Map(MIGRATION_REGISTRY.map((entry) => [entry.id, entry]));

export function migrationEntry(id: MigrationEntryId): MigrationEntry {
  const entry = BY_ID.get(id);
  if (!entry) throw new Error(`Unknown migration entry "${id}"`);
  return entry;
}

export const STATUS_ORDER: readonly MigrationStatus[] = [
  'in-progress',
  'todo',
  'done',
];

export const STATUS_LABEL: Readonly<Record<MigrationStatus, string>> = {
  todo: 'Chưa làm',
  'in-progress': 'Đang làm',
  done: 'Đã xong',
};

export const isComponentEntry = (e: MigrationEntry): e is ComponentEntry =>
  e.kind === 'component';
export const isRouteEntry = (e: MigrationEntry): e is RouteEntry =>
  e.kind === 'route';

export interface MigrationSummary {
  readonly total: number;
  readonly byStatus: Readonly<Record<MigrationStatus, number>>;
}

/** Counts per status for a set of entries. */
export function summarize(
  entries: readonly MigrationEntry[],
): MigrationSummary {
  const byStatus: Record<MigrationStatus, number> = {
    todo: 0,
    'in-progress': 0,
    done: 0,
  };
  for (const entry of entries) byStatus[entry.status]++;
  return { total: entries.length, byStatus };
}
