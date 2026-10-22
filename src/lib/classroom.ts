/**
 * Classroom identifiers and predefined room URL slug helpers.
 */

export const PRESET_CLASSROOMS = [
  'Sala 101',
  'Sala 102',
  'Sala 201',
  'Amfiteatrul A1',
  'Amfiteatrul A2',
  'Lab 204',
  'Lab 302',
  'C1',
  'C2',
] as const;

export const DEFAULT_CLASSROOM = 'Sala 101';

/**
 * Converts a classroom name into a clean, predictable URL slug bound to the room.
 * e.g. "Sala 101" -> "sala-101"
 *      "Amfiteatrul A1" -> "amfiteatrul-a1"
 *      "Lab 204" -> "lab-204"
 */
export function slugifyClassroom(input?: string | null): string {
  if (!input || !input.trim()) return 'sala-101';
  const clean = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return clean || 'sala-101';
}

/**
 * Returns a clean display name for a classroom.
 */
export function formatClassroomName(slugOrName?: string | null): string {
  if (!slugOrName || !slugOrName.trim()) return DEFAULT_CLASSROOM;
  const trimmed = slugOrName.trim();
  // If it's already nicely cased (e.g. "Sala 101"), return it
  if (/[A-Z]/.test(trimmed)) return trimmed;

  // Convert slug back to title case, e.g. "sala-101" -> "Sala 101"
  return trimmed
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
