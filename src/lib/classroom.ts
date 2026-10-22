/**
 * Classroom identifiers and predefined room URL slug helpers.
 */

export const PRESET_CLASSROOMS = [
  'Room 101',
  'Room 102',
  'Room 201',
  'Auditorium A1',
  'Auditorium A2',
  'Lab 204',
  'Lab 302',
  'Hall 1',
  'Hall 2',
] as const;

export const DEFAULT_CLASSROOM = 'Room 101';

/**
 * Converts a classroom name into a clean, predictable URL slug bound to the room.
 * e.g. "Room 101" -> "room-101"
 *      "Auditorium A1" -> "auditorium-a1"
 *      "Lab 204" -> "lab-204"
 */
export function slugifyClassroom(input?: string | null): string {
  if (!input || !input.trim()) return 'room-101';
  const clean = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return clean || 'room-101';
}

/**
 * Returns a clean display name for a classroom.
 */
export function formatClassroomName(slugOrName?: string | null): string {
  if (!slugOrName || !slugOrName.trim()) return DEFAULT_CLASSROOM;
  const trimmed = slugOrName.trim();
  // If it's already nicely cased (e.g. "Room 101"), return it
  if (/[A-Z]/.test(trimmed)) return trimmed;

  // Convert slug back to title case, e.g. "room-101" -> "Room 101"
  return trimmed
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
