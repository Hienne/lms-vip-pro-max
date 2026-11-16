import type { OrganizationInfo } from '@lms/contracts';

/** Presents visible organizations parent-first, including roots whose parent is outside scope. */
export function organizationOptions(
  orgs: readonly OrganizationInfo[],
): { org: OrganizationInfo; depth: number }[] {
  const byId = new Map(orgs.map((org) => [org.id, org]));
  const children = new Map<number, OrganizationInfo[]>();
  for (const org of orgs) {
    if (org.parentId != null && byId.has(org.parentId)) {
      const siblings = children.get(org.parentId) ?? [];
      siblings.push(org);
      children.set(org.parentId, siblings);
    }
  }
  const options: { org: OrganizationInfo; depth: number }[] = [];
  const visited = new Set<number>();
  const visit = (org: OrganizationInfo, depth: number): void => {
    if (visited.has(org.id)) return;
    visited.add(org.id);
    options.push({ org, depth });
    for (const child of children.get(org.id) ?? []) visit(child, depth + 1);
  };
  for (const org of orgs) {
    if (org.parentId == null || !byId.has(org.parentId)) visit(org, 0);
  }
  // Keep malformed or cyclic data visible without recursing forever.
  for (const org of orgs) visit(org, 0);
  return options;
}
