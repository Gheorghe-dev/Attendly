import { slugifyClassroom, formatClassroomName, PRESET_CLASSROOMS } from '@/lib/classroom';

describe('classroom URL slugification & formatting', () => {
  it('converts classroom names into predefined clean URL slugs', () => {
    expect(slugifyClassroom('Room 101')).toBe('room-101');
    expect(slugifyClassroom('Auditorium A1')).toBe('auditorium-a1');
    expect(slugifyClassroom('Lab 204')).toBe('lab-204');
    expect(slugifyClassroom('Hall 1')).toBe('hall-1');
    expect(slugifyClassroom('')).toBe('room-101');
    expect(slugifyClassroom(null)).toBe('room-101');
    expect(slugifyClassroom('Room%20101')).toBe('room-101');
    expect(slugifyClassroom('Auditorium%20A1')).toBe('auditorium-a1');
  });

  it('formats classroom display names cleanly', () => {
    expect(formatClassroomName('Room 101')).toBe('Room 101');
    expect(formatClassroomName('room-101')).toBe('Room 101');
    expect(formatClassroomName('auditorium-a1')).toBe('Auditorium A1');
    expect(formatClassroomName('Room%20101')).toBe('Room 101');
    expect(formatClassroomName('auditorium%20a1')).toBe('Auditorium A1');
  });

  it('includes common university presets', () => {
    expect(PRESET_CLASSROOMS).toContain('Room 101');
    expect(PRESET_CLASSROOMS).toContain('Auditorium A1');
    expect(PRESET_CLASSROOMS).toContain('Lab 204');
  });
});
