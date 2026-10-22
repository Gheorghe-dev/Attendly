import { slugifyClassroom, formatClassroomName, PRESET_CLASSROOMS } from '@/lib/classroom';

describe('classroom URL slugification & formatting', () => {
  it('converts classroom names into predefined clean URL slugs', () => {
    expect(slugifyClassroom('Sala 101')).toBe('sala-101');
    expect(slugifyClassroom('Amfiteatrul A1')).toBe('amfiteatrul-a1');
    expect(slugifyClassroom('Lab 204')).toBe('lab-204');
    expect(slugifyClassroom('Săliță C2')).toBe('salita-c2');
    expect(slugifyClassroom('C1')).toBe('c1');
    expect(slugifyClassroom('')).toBe('sala-101');
    expect(slugifyClassroom(null)).toBe('sala-101');
  });

  it('formats classroom display names cleanly', () => {
    expect(formatClassroomName('Sala 101')).toBe('Sala 101');
    expect(formatClassroomName('sala-101')).toBe('Sala 101');
    expect(formatClassroomName('amfiteatrul-a1')).toBe('Amfiteatrul A1');
  });

  it('includes common university presets', () => {
    expect(PRESET_CLASSROOMS).toContain('Sala 101');
    expect(PRESET_CLASSROOMS).toContain('Amfiteatrul A1');
    expect(PRESET_CLASSROOMS).toContain('Lab 204');
  });
});
