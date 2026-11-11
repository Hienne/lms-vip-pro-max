// Public API of @lms/ui. Export every public symbol from here.
export {
  RadarChart,
  type RadarDatum,
} from './lib/organisms/charts/radar-chart';
export { BarChart, type BarDatum } from './lib/organisms/charts/bar-chart';
export {
  DonutChart,
  type DonutDatum,
} from './lib/organisms/charts/donut-chart';
export { Icon, type IconSize } from './lib/atoms/icon/icon';
export {
  ICON_CATALOG,
  registeredIcon,
  type IconName,
} from './lib/atoms/icon/icon-registry';
export { Mai, type MaiTone } from './lib/atoms/mai/mai';
export { MaiBadge } from './lib/atoms/mai-badge/mai-badge';
export {
  Segmented,
  type SegmentedOption,
} from './lib/molecules/segmented/segmented';
export { Popover } from './lib/organisms/popover/popover.directive';
export {
  Button,
  type ButtonSize,
  type ButtonType,
  type ButtonVariant,
} from './lib/atoms/button/button.directive';
export {
  IconButton,
  type IconButtonSize,
  type IconButtonVariant,
} from './lib/atoms/icon-button/icon-button.directive';
export { LinkButton } from './lib/atoms/link-button/link-button.directive';
export { Checkbox } from './lib/atoms/checkbox/checkbox.directive';
export type { ControlSize } from './lib/atoms/control-size';
export { Input } from './lib/atoms/input/input.directive';
export { Select } from './lib/atoms/select/select.directive';
export { Switch } from './lib/atoms/switch/switch.directive';
export { Textarea } from './lib/atoms/textarea/textarea.directive';
export { Badge, type BadgeTone } from './lib/atoms/badge/badge.directive';
export { Card, type CardVariant } from './lib/atoms/card/card.directive';
export { CardBody } from './lib/atoms/card/card-body.directive';
export { CardHeader } from './lib/atoms/card/card-header.directive';
export { Chip } from './lib/atoms/chip/chip.directive';
export { List } from './lib/atoms/list/list.directive';
export { ListItem } from './lib/atoms/list/list-item.directive';
export { ListIcon } from './lib/atoms/list/list-icon.directive';
export {
  Skeleton,
  type SkeletonVariant,
} from './lib/atoms/skeleton/skeleton.directive';
export { Spinner } from './lib/atoms/spinner/spinner.directive';
export { Avatar, type AvatarSize } from './lib/atoms/avatar/avatar';
export { AvatarGroup } from './lib/atoms/avatar/avatar-group.directive';
export {
  Progress,
  type ProgressSize,
  type ProgressTone,
} from './lib/atoms/progress/progress';
export { Ring } from './lib/atoms/ring/ring';
export { Table } from './lib/atoms/table/table.directive';
export { TableWrap } from './lib/atoms/table/table-wrap.directive';
export { TableCell } from './lib/atoms/table/table-cell.directive';
export { TableCol } from './lib/atoms/table/table-col.directive';
export { TablePrimary } from './lib/atoms/table/table-primary.directive';
export { TableSub } from './lib/atoms/table/table-sub.directive';

// Insertion points for the base-libraries UI tickets: add your exports inside your own block,
// keep the marker comment, and do not touch the other blocks.

// Tooltip (04)
export { Tooltip } from './lib/atoms/tooltip/tooltip.directive';

// Field, ErrorSummary (05)
export { Field } from './lib/molecules/field/field';
export {
  ErrorSummary,
  type ErrorSummaryItem,
} from './lib/molecules/field/error-summary';

// Alert, Tip (06)
export {
  Alert,
  AlertAction,
  type AlertTone,
} from './lib/molecules/alert/alert';
export { Tip } from './lib/molecules/tip/tip';

// Empty, ErrorState (07)
export {
  Empty,
  type EmptyHeadingLevel,
  type EmptyTone,
  type EmptyVariant,
} from './lib/molecules/empty/empty';
export { ErrorState } from './lib/molecules/error-state/error-state';

// Breadcrumb, PageHeader (08)
export {
  Breadcrumb,
  type BreadcrumbItem,
} from './lib/molecules/breadcrumb/breadcrumb';
export { PageHeader } from './lib/organisms/page-header/page-header';

// Menu (09)
export {
  Menu,
  type MenuEntry,
  type MenuItemEntry,
  type MenuLabelEntry,
  type MenuSeparatorEntry,
} from './lib/organisms/menu/menu';

// ConfirmDialog, confirm, Drawer (10)
export {
  ConfirmDialog,
  choose,
  confirm,
  type ConfirmOptions,
  type ConfirmTone,
} from './lib/organisms/confirm-dialog/confirm-dialog';
export {
  Drawer,
  type DrawerContext,
  type DrawerSide,
} from './lib/organisms/drawer/drawer';

// Declarative drawer, FormActions
export { DrawerOutlet } from './lib/organisms/drawer/drawer.directive';
export { FormActions } from './lib/molecules/form-actions/form-actions';

// Toaster (11)
export {
  Toaster,
  type Toast,
  type ToastKind,
} from './lib/organisms/toaster/toaster';

// Timer
export { Timer } from './lib/molecules/timer/timer';

// Sortable list
export {
  SortableItem,
  SortableList,
  type SortableAnnouncement,
  type SortableDirection,
  type SortableMove,
} from './lib/molecules/sortable/sortable';

// Tree
export {
  Tree,
  type TreeNode,
  type TreeTrailingContext,
} from './lib/organisms/tree/tree';

// Stepper
export { Stepper, type StepperItem } from './lib/organisms/stepper/stepper';

// Dropzone, UploadItem
export { Dropzone } from './lib/molecules/upload/dropzone.directive';
export {
  UploadItem,
  type UploadState,
} from './lib/molecules/upload/upload-item';

// OptionCard
export {
  OptionCard,
  type OptionCardTone,
} from './lib/molecules/option-card/option-card';

// Kpi (remaining-ui 04)
export { Kpi, type KpiTone } from './lib/molecules/kpi/kpi';

// Stars, Rating (remaining-ui 03)
export { Stars } from './lib/molecules/rating/stars';
export { Rating } from './lib/molecules/rating/rating';

// Tabs (remaining-ui 02)
export { Tabs, TabPanel, type TabItem } from './lib/molecules/tabs/tabs';

// Search (remaining-ui 01)
export { Search } from './lib/molecules/search/search';

// Format pipes, NOW clock token (app-foundation 01)
export {
  FmtBytesPipe,
  FmtDatePipe,
  FmtDatetimePipe,
  FmtDaysLeftPipe,
  FmtMinutesPipe,
  FmtNumPipe,
  FmtPctPipe,
  FmtRelativePipe,
  FmtScorePipe,
  FmtTimePipe,
} from './lib/atoms/format/format.pipes';
export { NOW } from './lib/atoms/format/now';

// Pagination, DataTable
export { Pagination } from './lib/molecules/pagination/pagination';
export {
  DataTable,
  type DataTableColumn,
  type DataTableSort,
} from './lib/organisms/data-table/data-table';
export { DataTableHeader } from './lib/organisms/data-table/data-table-header.directive';
export {
  DataTableCell,
  type DataTableCellContext,
} from './lib/organisms/data-table/data-table-cell.directive';

// Screen building blocks: SectionCard, StatStrip, Stat, ListRow
export { SectionCard } from './lib/organisms/section-card/section-card';
export { StatStrip } from './lib/molecules/stat-strip/stat-strip';
export { Stat, type StatTone } from './lib/molecules/stat-strip/stat';
export { ListRow, type ListRowTone } from './lib/molecules/list-row/list-row';
export { DateInput } from './lib/molecules/date-input/date-input';
export type { DateInputKind } from './lib/molecules/date-input/date-format';

export { HorizontalBarChart } from './lib/organisms/charts/horizontal-bar-chart';
