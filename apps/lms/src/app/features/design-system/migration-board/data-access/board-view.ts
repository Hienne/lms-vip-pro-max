import {
  MIGRATION_REGISTRY,
  STATUS_LABEL,
  STATUS_ORDER,
  summarize,
  type MigrationSummary,
} from '../../data-access/migration-registry';
import type {
  MigrationEntry,
  MigrationStatus,
  VerifyState,
} from '../../data-access/migration-entry.schema';

const CHECK_LABELS = [
  ['lightDark', 'Sáng/tối'],
  ['widths', '375/768/1280'],
  ['keyboard', 'Bàn phím'],
  ['errorStates', 'Trạng thái lỗi'],
] as const;

const STATE_MARK: Readonly<Record<VerifyState, string>> = {
  done: '✓',
  todo: '○',
  'n/a': '–',
};

const STATE_TEXT: Readonly<Record<VerifyState, string>> = {
  done: 'đã kiểm tra',
  todo: 'chưa kiểm tra',
  'n/a': 'không áp dụng',
};

export interface BoardRow {
  readonly id: string;
  readonly mockupSource: string;
  readonly target: string;
  readonly level: string;
  readonly checklist: string;
  readonly owner: string | undefined;
  readonly pullRequest: string | undefined;
  readonly checks: readonly {
    readonly label: string;
    readonly mark: string;
    readonly text: string;
  }[];
}

export interface BoardStatusGroup {
  readonly status: MigrationStatus;
  readonly label: string;
  readonly rows: readonly BoardRow[];
}

export interface BoardKindGroup {
  readonly kind: MigrationEntry['kind'];
  readonly label: string;
  readonly summary: MigrationSummary;
  readonly statuses: readonly BoardStatusGroup[];
}

const KIND_LABEL: Readonly<Record<MigrationEntry['kind'], string>> = {
  component: 'Thành phần',
  route: 'Route',
};

function toRow(entry: MigrationEntry): BoardRow {
  return {
    id: entry.id,
    mockupSource: entry.mockupSource ?? '—',
    target:
      entry.kind === 'component'
        ? entry.targets.join(', ')
        : `/${entry.target}`,
    level: entry.kind === 'component' ? entry.level : 'route',
    checklist: entry.checklist.join(', ') || '—',
    owner: entry.owner,
    pullRequest: entry.pullRequest,
    checks: CHECK_LABELS.map(([key, label]) => ({
      label,
      mark: STATE_MARK[entry.verify[key]],
      text: STATE_TEXT[entry.verify[key]],
    })),
  };
}

/** Entries grouped by kind and then by status (in progress first), with counts per kind. */
export function buildBoard(
  entries: readonly MigrationEntry[] = MIGRATION_REGISTRY,
): readonly BoardKindGroup[] {
  return (['component', 'route'] as const).map((kind) => {
    const ofKind = entries.filter((entry) => entry.kind === kind);
    return {
      kind,
      label: KIND_LABEL[kind],
      summary: summarize(ofKind),
      statuses: STATUS_ORDER.map((status) => ({
        status,
        label: STATUS_LABEL[status],
        rows: ofKind.filter((entry) => entry.status === status).map(toRow),
      })).filter((group) => group.rows.length > 0),
    };
  });
}
