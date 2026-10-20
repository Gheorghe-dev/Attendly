import nodemailer from 'nodemailer';

export interface EmailSendResult {
  /** Did the email actually get sent? */
  ok: boolean;
  /** True when the app is in "dev mode" and no real email was sent. */
  devMode: boolean;
  /** Error message if ok=false and devMode=false. */
  error?: string;
}

/** True when SMTP credentials look usable. Used to decide between real email and dev mode. */
export function isSmtpConfigured(): boolean {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  // Explicit dev flag always wins.
  if (process.env.DEV_MODE_EMAIL === '1' || process.env.DEV_MODE_EMAIL === 'true') return false;
  // Need at least a host and credentials to bother trying.
  return Boolean(host && user && pass);
}

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendVerificationEmail({
  to,
  verificationUrl,
  courseName,
  sessionDate,
  studentName,
}: {
  to: string;
  verificationUrl: string;
  courseName: string;
  sessionDate: string;
  studentName: string;
}): Promise<EmailSendResult> {
  // Dev / no-SMTP mode: don't even open a connection. Just log to the server console.
  if (!isSmtpConfigured()) {
    console.log(
      [
        '',
        '┌──────────────────────────────────────────────────────────────────┐',
        '│  DEV MODE — no SMTP configured. Skipped sending real email.      │',
        '│  To: ' + to.padEnd(58) + '│',
        '│  Verification URL:                                               │',
        `│  ${verificationUrl.padEnd(62)}│`,
        '│  Set SMTP_HOST / SMTP_USER / SMTP_PASS in .env to enable real    │',
        '│  email delivery.                                                 │',
        '└──────────────────────────────────────────────────────────────────┘',
        '',
      ].join('\n')
    );
    return { ok: true, devMode: true };
  }

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@university.edu',
      to,
      subject: `Verify Your Attendance — ${courseName}`,
      text: `Hello ${studentName},\n\nPlease verify your attendance for ${courseName} on ${sessionDate} by clicking:\n${verificationUrl}\n\nThis link expires in 15 minutes.\n\nIf you did not submit attendance, ignore this email.`,
      html: `<p>Hello <strong>${studentName}</strong>,</p>
<p>Please verify your attendance for <strong>${courseName}</strong> on <strong>${sessionDate}</strong> by clicking the button below:</p>
<p><a href="${verificationUrl}" style="background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Verify My Attendance</a></p>
<p>This link expires in <strong>15 minutes</strong>.</p>
<p>If you did not submit attendance, you can ignore this email.</p>`,
    });
    return { ok: true, devMode: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[email] SMTP send failed:', message);
    return { ok: false, devMode: false, error: message };
  }
}
