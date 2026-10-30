import {
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  maxLength,
  required,
  type SchemaPath,
  validate,
} from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  COMMUNITY_LIMITS,
  type ModerationAction,
  type ModeratorStatus,
  type ReportTarget,
} from '@lms/contracts';
import {
  Alert,
  Badge,
  type BadgeTone,
  Breadcrumb,
  Button,
  Card,
  CardBody,
  DrawerOutlet,
  Empty,
  ErrorState,
  Field,
  FmtDatetimePipe,
  FmtNumPipe,
  Input,
  PageHeader,
  Pagination,
  Segmented,
  type SegmentedOption,
  Select,
  Skeleton,
  Table,
  TablePrimary,
  TableSub,
  TableWrap,
  type TabItem,
  TabPanel,
  Tabs,
  Textarea,
} from '@lms/ui';
import { Markdown } from '../../../shared/content/markdown/markdown';
import { reportReasonLabel } from '../data-access/community-labels';
import { ModeratorsStore } from './data-access/moderators.store';
import {
  REPORTS_PAGE_SIZE,
  type ReportFilter,
  ReportsStore,
} from './data-access/reports.store';

type Tab = 'reports' | 'moderators';

const STATUS_LABELS: Readonly<
  Record<string, { label: string; tone: BadgeTone }>
> = {
  open: { label: 'Chưa xử lý', tone: 'warning' },
  in_review: { label: 'Đang xử lý', tone: 'info' },
  resolved: { label: 'Đã giải quyết', tone: 'neutral' },
  dismissed: { label: 'Đã bác bỏ', tone: 'neutral' },
};

const TARGET_LABELS: Readonly<Record<ReportTarget['kind'], string>> = {
  question: 'Câu hỏi',
  answer: 'Câu trả lời',
  article: 'Bài viết',
  lesson: 'Bài học sự cố',
  comment: 'Bình luận',
};

const ACTIONS: readonly {
  value: ModerationAction;
  label: string;
  hint: string;
  only?: readonly ReportTarget['kind'][];
  not?: readonly ReportTarget['kind'][];
}[] = [
  {
    value: 'hide',
    label: 'Ẩn nội dung',
    hint: 'Mọi người không còn thấy nội dung; tác giả chỉ thấy lý do. Khôi phục được.',
  },
  {
    value: 'soft_delete',
    label: 'Xóa mềm',
    hint: 'Gỡ nội dung nhưng vẫn lưu lịch sử.',
  },
  {
    value: 'close',
    label: 'Đóng câu hỏi',
    hint: 'Câu hỏi không nhận thêm câu trả lời hay bình luận.',
    only: ['question'],
  },
  {
    value: 'assign_maintainer',
    label: 'Chuyển người duy trì',
    hint: 'Giao nội dung cho người khác chăm sóc.',
    not: ['comment'],
  },
  {
    value: 'warn',
    label: 'Cảnh báo tác giả',
    hint: 'Giữ nội dung, ghi nhận cảnh báo.',
  },
  {
    value: 'dismiss',
    label: 'Bác bỏ báo cáo',
    hint: 'Nội dung không vi phạm; báo cáo chuyển sang Đã bác bỏ.',
  },
];

const ACTION_NAMES: Readonly<Record<string, string>> = {
  hide: 'Ẩn nội dung',
  restore: 'Khôi phục nội dung',
  restore_deleted: 'Khôi phục nội dung đã xóa',
  soft_delete: 'Xóa mềm',
  close: 'Đóng câu hỏi',
  assign_maintainer: 'Chuyển người duy trì',
  warn: 'Cảnh báo tác giả',
  dismiss: 'Bác bỏ báo cáo',
};

const L = COMMUNITY_LIMITS;

const reasonRules = (path: SchemaPath<string>): void => {
  validate(path, ({ value }) =>
    value().trim().length < L.reason.min
      ? {
          kind: 'minLength',
          message: `Lý do cần ít nhất ${L.reason.min} ký tự.`,
        }
      : undefined,
  );
  maxLength(path, L.reason.max, {
    message: `Lý do tối đa ${L.reason.max.toLocaleString('vi-VN')} ký tự.`,
  });
};

/**
 * Điều phối cộng đồng (CM-08). Moderators work the report queue; an ADMIN of the unit appoints
 * moderators. Each tab shows only when the server answers it (a 403 hides it).
 */
@Component({
  selector: 'app-community-moderation',
  imports: [
    Alert,
    Badge,
    Breadcrumb,
    Button,
    Card,
    CardBody,
    DrawerOutlet,
    Empty,
    ErrorState,
    Field,
    FmtDatetimePipe,
    FmtNumPipe,
    FormField,
    FormRoot,
    Input,
    Markdown,
    PageHeader,
    Pagination,
    RouterLink,
    Segmented,
    Select,
    Skeleton,
    Table,
    TablePrimary,
    TableSub,
    TableWrap,
    TabPanel,
    Tabs,
    Textarea,
  ],
  providers: [ReportsStore, ModeratorsStore],
  templateUrl: './moderation.html',
  styleUrl: './moderation.scss',
})
export class CommunityModeration {
  protected readonly reports = inject(ReportsStore);
  protected readonly moderators = inject(ModeratorsStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly pageSize = REPORTS_PAGE_SIZE;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly targetLabels = TARGET_LABELS;
  protected readonly actionNames = ACTION_NAMES;
  protected readonly reasonLabel = reportReasonLabel;
  protected readonly reasonMax = L.reason.max;
  protected readonly filters: readonly SegmentedOption<ReportFilter>[] = [
    { value: 'all', label: 'Tất cả' },
    { value: 'open', label: 'Chưa xử lý' },
    { value: 'in_review', label: 'Đang xử lý' },
    { value: 'resolved', label: 'Đã giải quyết' },
    { value: 'dismissed', label: 'Đã bác bỏ' },
    { value: 'mine', label: 'Được giao cho tôi' },
  ];
  protected readonly moderatorStatuses: readonly SegmentedOption<ModeratorStatus>[] =
    [
      { value: 'active', label: 'Đang hoạt động' },
      { value: 'revoked', label: 'Đã thu hồi' },
    ];

  protected readonly tabs = computed((): TabItem[] => [
    ...(this.reports.isForbidden$()
      ? []
      : [
          {
            id: 'reports',
            label: 'Báo cáo',
            ...(this.reports.openCount$()
              ? { count: this.reports.openCount$() }
              : {}),
          },
        ]),
    ...(!this.moderators.canAppoint$() || this.moderators.isForbidden$()
      ? []
      : [{ id: 'moderators', label: 'Người điều phối' }]),
  ]);

  /** The open tab: the URL's, while that tab is shown; else the first one shown. */
  protected readonly tab = linkedSignal<TabItem[], Tab>({
    source: this.tabs,
    computation: (tabs, previous) => {
      const wanted =
        previous?.value ?? this.route.snapshot.queryParamMap.get('tab');
      return (tabs.find((t) => t.id === wanted)?.id ??
        tabs[0]?.id ??
        'reports') as Tab;
    },
  });

  protected readonly description = computed(() => {
    const ids = this.tabs().map((t) => t.id);
    if (ids.length === 2)
      return 'Xử lý báo cáo vi phạm và quản lý người điều phối của Ban.';
    return ids[0] === 'moderators'
      ? 'Bổ nhiệm và thu hồi người điều phối của Ban.'
      : 'Xử lý báo cáo vi phạm trong Ban.';
  });

  protected readonly actions = computed(() => {
    const kind = this.reports.report$()?.target?.kind;
    return ACTIONS.filter(
      (a) =>
        (!a.only || (kind && a.only.includes(kind))) &&
        !(kind && a.not?.includes(kind)),
    );
  });

  // The case form: an action, the reason, and a maintainer for "Chuyển người duy trì".
  private readonly actModel = signal({
    action: '',
    reason: '',
    maintainerUserId: '',
  });
  protected readonly actForm = form(
    this.actModel,
    (path) => {
      required(path.action, { message: 'Chọn một hành động.' });
      reasonRules(path.reason);
      validate(path.maintainerUserId, ({ value, valueOf }) =>
        valueOf(path.action) === 'assign_maintainer' && !value()
          ? { kind: 'required', message: 'Chọn người duy trì.' }
          : undefined,
      );
    },
    {
      submission: {
        action: async () => {
          const { action, reason, maintainerUserId } = this.actModel();
          this.reports.act({
            action: action as ModerationAction,
            reason: reason.trim(),
            ...(action === 'assign_maintainer' ? { maintainerUserId } : {}),
          });
        },
      },
    },
  );

  // The moderator drawer: who, and why.
  private readonly moderatorModel = signal({
    userId: '',
    query: '',
    reason: '',
  });
  protected readonly moderatorForm = form(
    this.moderatorModel,
    (path) => {
      required(path.userId, { message: 'Chọn người được bổ nhiệm.' });
      reasonRules(path.reason);
    },
    {
      submission: {
        action: async () =>
          this.moderators.save(
            this.moderatorModel().userId,
            this.moderatorModel().reason.trim(),
          ),
      },
    },
  );
  protected readonly drawerTitle = computed(() => {
    switch (this.moderators.edit$()?.kind) {
      case 'revoke':
        return 'Thu hồi quyền điều phối';
      case 'regrant':
        return 'Cấp lại quyền điều phối';
      default:
        return 'Bổ nhiệm người điều phối';
    }
  });

  constructor() {
    // A new case starts with an empty form.
    effect(() => {
      this.reports.reportId$();
      this.actModel.set({ action: '', reason: '', maintainerUserId: '' });
    });
    // The drawer starts from the person it is about.
    effect(() => {
      const edit = this.moderators.edit$();
      this.moderatorModel.set({
        userId: edit && edit.kind !== 'grant' ? edit.moderator.userId : '',
        query: '',
        reason: '',
      });
    });
    // The person searches follow what is typed.
    effect(() => this.moderators.searchCandidates(this.moderatorModel().query));
  }

  protected selectTab(tab: string): void {
    this.tab.set(tab as Tab);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        tab: tab === this.tabs()[0]?.id ? null : tab,
        status: null,
        page: null,
        report: null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected chooseAction(action: string): void {
    if (action === 'assign_maintainer') this.reports.searchPeople('');
  }

  protected reportCode(id: number): string {
    return `BC-${id}`;
  }
}
