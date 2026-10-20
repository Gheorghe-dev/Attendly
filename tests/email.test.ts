import { isSmtpConfigured, sendVerificationEmail } from '@/lib/email';

describe('email utilities', () => {
  it('isSmtpConfigured returns false when SMTP creds are empty', () => {
    const orig = { host: process.env.SMTP_HOST, user: process.env.SMTP_USER, pass: process.env.SMTP_PASS };
    process.env.SMTP_HOST = '';
    process.env.SMTP_USER = '';
    process.env.SMTP_PASS = '';
    expect(isSmtpConfigured()).toBe(false);
    process.env.SMTP_HOST = orig.host;
    process.env.SMTP_USER = orig.user;
    process.env.SMTP_PASS = orig.pass;
  });

  it('sendVerificationEmail succeeds in dev mode (no SMTP)', async () => {
    const orig = { host: process.env.SMTP_HOST, user: process.env.SMTP_USER, pass: process.env.SMTP_PASS };
    process.env.SMTP_HOST = '';
    process.env.SMTP_USER = '';
    process.env.SMTP_PASS = '';
    const result = await sendVerificationEmail({
      to: 'test@uni.edu',
      verificationUrl: 'http://localhost:3000/verify?token=abc',
      courseName: 'Test Course',
      sessionDate: '19/10/2026',
      studentName: 'Test Student',
    });
    expect(result.ok).toBe(true);
    expect(result.devMode).toBe(true);
    process.env.SMTP_HOST = orig.host;
    process.env.SMTP_USER = orig.user;
    process.env.SMTP_PASS = orig.pass;
  });
});
