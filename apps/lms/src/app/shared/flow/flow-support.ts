import { InjectionToken } from '@angular/core';
import type { FlowKind, FlowModel, FlowStep } from '@lms/contracts';
import type { IconName } from '@lms/ui';

/** The palette name of each kind (spec → UI copy). */
export const FLOW_KIND_LABEL: Record<FlowKind, string> = {
  customer: 'Khách hàng',
  staff: 'Cán bộ',
  channel: 'Kênh (App/Web/Quầy)',
  system: 'Hệ thống nội bộ',
  database: 'Cơ sở dữ liệu',
  queue: 'Hàng đợi',
  gateway: 'API / Gateway',
  document: 'Chứng từ',
  external: 'Hệ thống ngoài',
  decision: 'Quyết định',
};

export const FLOW_KIND_ICON: Record<FlowKind, IconName> = {
  customer: 'user',
  staff: 'users',
  channel: 'monitor',
  system: 'layers',
  database: 'database',
  queue: 'list',
  gateway: 'network',
  document: 'file-text',
  external: 'globe',
  decision: 'workflow',
};

/** Whether this browser can draw the scene; a token so specs can stub it. */
export const FLOW_WEBGL = new InjectionToken<boolean>('FLOW_WEBGL', {
  providedIn: 'root',
  factory: () => {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
    } catch {
      return false;
    }
  },
});

/** Whether the learner asked the system for less motion; a token so specs can stub it. */
export const FLOW_REDUCED_MOTION = new InjectionToken<boolean>(
  'FLOW_REDUCED_MOTION',
  {
    providedIn: 'root',
    factory: () =>
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches,
  },
);

/** "Khách hàng (Khách hàng) → Core Banking (Hệ thống nội bộ)" or "… | tự xử lý". */
export function stepRoute(flow: FlowModel, step: FlowStep): string {
  const named = (id: string) => {
    const object = flow.objects.find((o) => o.id === id);
    return object ? `${object.name} (${FLOW_KIND_LABEL[object.kind]})` : id;
  };
  return step.to
    ? `${named(step.from)} → ${named(step.to)}`
    : `${named(step.from)} · tự xử lý`;
}
