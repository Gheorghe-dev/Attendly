import { generateQRCodeDataURL, getAttendanceUrl, isPrivateOrLocalUrl, pickBaseUrl, setMemoryTunnelUrl } from '@/lib/qrcode';

describe('QR Code', () => {
  it('generates a data URL', async () => {
    const url = await generateQRCodeDataURL('https://university.edu/attend/test-token');
    expect(url).toMatch(/^data:image\/png;base64,/);
  }, 15000);

  it('getAttendanceUrl produces correct URL', () => {
    process.env.APP_URL = 'https://university.edu';
    const url = getAttendanceUrl('abc123');
    expect(url).toBe('https://university.edu/attend/abc123');
  });

  it('isPrivateOrLocalUrl accurately identifies local and private network addresses', () => {
    expect(isPrivateOrLocalUrl('http://localhost:3000')).toBe(true);
    expect(isPrivateOrLocalUrl('http://127.0.0.1:3000')).toBe(true);
    expect(isPrivateOrLocalUrl('http://192.168.1.100:3000')).toBe(true);
    expect(isPrivateOrLocalUrl('http://10.20.30.40:3000')).toBe(true);
    expect(isPrivateOrLocalUrl('http://172.20.0.5:3000')).toBe(true);
    expect(isPrivateOrLocalUrl('http://laptop.local:3000')).toBe(true);

    expect(isPrivateOrLocalUrl('https://abc-123.trycloudflare.com')).toBe(false);
    expect(isPrivateOrLocalUrl('https://attendly.university.edu')).toBe(false);
  });

  it('pickBaseUrl prioritizes worldwide tunnel over LAN or localhost forceOrigin', () => {
    setMemoryTunnelUrl('https://worldwide-live.trycloudflare.com');
    const url = pickBaseUrl('http://192.168.1.250:3000');
    expect(url).toBe('https://worldwide-live.trycloudflare.com');
    setMemoryTunnelUrl(null);
  });
});
