/**
 * Groups are persisted as a single comma-separated string on `Session.groups`.
 * Keep all parse/format logic here so we don't repeat the same `.split(',').map(...).trim()`
 * dance across the codebase.
 */

const SEPARATOR = ',';

export function parseGroups(groups: string | null | undefined): string[] {
  if (!groups) return [];
  return groups
    .split(SEPARATOR)
    .map((g) => g.trim())
    .filter(Boolean);
}

export function formatGroups(groups: string[]): string {
  return groups.map((g) => g.trim()).filter(Boolean).join(SEPARATOR);
}
