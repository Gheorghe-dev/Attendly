import { parseGroups, formatGroups } from '@/lib/groups';

describe('Groups parser and formatter', () => {
  it('parses empty or null group strings', () => {
    expect(parseGroups('')).toEqual([]);
    expect(parseGroups(null)).toEqual([]);
    expect(parseGroups(undefined)).toEqual([]);
  });

  it('parses comma-separated group string with spaces', () => {
    const parsed = parseGroups('Group A,  Group B , Group C  ');
    expect(parsed).toEqual(['Group A', 'Group B', 'Group C']);
  });

  it('filters empty segments and trims properly', () => {
    const parsed = parseGroups(',Group 1,, Group 2, ');
    expect(parsed).toEqual(['Group 1', 'Group 2']);
  });

  it('formats array of groups back to comma-separated string', () => {
    const formatted = formatGroups(['Group A', '  Group B  ', 'Group C']);
    expect(formatted).toBe('Group A,Group B,Group C');
  });
});
