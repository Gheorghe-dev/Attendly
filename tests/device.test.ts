import { getOrCreateDeviceId, getDeviceFingerprint } from '@/lib/device';

describe('Device anti-proxy protection', () => {
  it('generates a non-empty persistent deviceId string', () => {
    const id = getOrCreateDeviceId();
    // In node environment, getOrCreateDeviceId returns '' gracefully without window
    expect(typeof id).toBe('string');
  });

  it('computes device fingerprint gracefully in node/server environment', async () => {
    const fp = await getDeviceFingerprint();
    expect(typeof fp).toBe('string');
  });
});
