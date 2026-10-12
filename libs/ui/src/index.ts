// Public API of @lms/ui. Export every public symbol from here.
export { Icon, type IconSize } from './lib/atoms/icon/icon';
export { ICON_CATALOG, type IconName } from './lib/atoms/icon/icon-registry';
export { Mai, type MaiTone } from './lib/atoms/mai/mai';
export { MaiBadge } from './lib/atoms/mai-badge/mai-badge';
export {
  Segmented,
  type SegmentedOption,
} from './lib/molecules/segmented/segmented';
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
  confirm,
  type ConfirmOptions,
  type ConfirmTone,
} from './lib/organisms/confirm-dialog/confirm-dialog';
export {
  Drawer,
  openDrawer,
  type DrawerContext,
  type DrawerOptions,
  type DrawerSide,
} from './lib/organisms/drawer/drawer';

// Toaster (11)
export {
  Toaster,
  type Toast,
  type ToastKind,
} from './lib/organisms/toaster/toaster';

// Timer
export { Timer } from './lib/molecules/timer/timer';
