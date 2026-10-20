// Test the email normalization logic (pure unit tests)
describe('Email normalization', () => {
  function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  const cases = [
    ['alice@uni.edu', 'alice@uni.edu'],
    ['  ALICE@UNI.EDU  ', 'alice@uni.edu'],
    ['Alice@University.EDU', 'alice@university.edu'],
    ['\t user@domain.com \n', 'user@domain.com'],
  ];

  it.each(cases)('normalizes "%s" to "%s"', (input, expected) => {
    expect(normalizeEmail(input)).toBe(expected);
  });
});
