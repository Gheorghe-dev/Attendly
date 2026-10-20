import { generateQRCodeDataURL, getAttendanceUrl } from '@/lib/qrcode';

describe('QR Code', () => {
  it('generates a data URL', async () => {
    const url = await generateQRCodeDataURL('https://university.edu/attend/test-token');
    expect(url).toMatch(/^data:image\/png;base64,/);
  });

  it('getAttendanceUrl produces correct URL', () => {
    process.env.APP_URL = 'https://university.edu';
    const url = getAttendanceUrl('abc123');
    expect(url).toBe('https://university.edu/attend/abc123');
  });
});
