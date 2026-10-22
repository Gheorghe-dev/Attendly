/**
 * Client & Server Device Identification & Fingerprinting Utilities
 * Prevents multiple student check-ins using the same device in the same session.
 */

const DEVICE_ID_KEY = 'attendly_device_id';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * Generates or retrieves a persistent, high-durability unique device ID.
 * Synchronized across localStorage and document.cookie.
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    // 1. Try localStorage
    let storedId = localStorage.getItem(DEVICE_ID_KEY);

    // 2. Try cookie fallback
    if (!storedId && typeof document !== 'undefined') {
      const match = document.cookie.match(new RegExp(`(?:^|; )${DEVICE_ID_KEY}=([^;]*)`));
      if (match && match[1]) {
        storedId = decodeURIComponent(match[1]);
      }
    }

    // 3. If still none, generate new UUID
    if (!storedId) {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        storedId = crypto.randomUUID();
      } else {
        storedId = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
      }
    }

    // 4. Ensure stored in both localStorage and cookie for maximum persistence
    try {
      localStorage.setItem(DEVICE_ID_KEY, storedId);
    } catch {
      // Ignore localStorage quotas / private mode restrictions
    }

    if (typeof document !== 'undefined') {
      document.cookie = `${DEVICE_ID_KEY}=${encodeURIComponent(
        storedId
      )}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax`;
    }

    return storedId;
  } catch {
    return '';
  }
}

/**
 * Fast synchronous DJB2-based string hash for fingerprint components.
 */
function djb2Hash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return (hash >>> 0).toString(16);
}

/**
 * Canvas rendering fingerprint signature.
 * Draws geometry, gradients, emoji and text to produce a hardware-specific rendering hash.
 */
function getCanvasFingerprint(): string {
  if (typeof document === 'undefined') return '';
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 240, 60);
    grad.addColorStop(0, '#f43f5e');
    grad.addColorStop(0.5, '#3b82f6');
    grad.addColorStop(1, '#10b981');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 240, 60);

    // Text rendering with blend mode & subpixel rendering
    ctx.textBaseline = 'top';
    ctx.font = '16px "Arial", "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Attendly 🛡️ Security Signature', 10, 10);

    // Bezier curve & geometric drawing
    ctx.beginPath();
    ctx.arc(200, 30, 20, 0, Math.PI * 2, true);
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 3;
    ctx.stroke();

    return djb2Hash(canvas.toDataURL());
  } catch {
    return '';
  }
}

/**
 * Computes a hardware & browser environment fingerprint hash.
 * Resistant to incognito tab recreation by inspecting physical hardware & rendering signals.
 */
export async function getDeviceFingerprint(): Promise<string> {
  if (typeof window === 'undefined') return '';

  const components: string[] = [];

  try {
    // Screen properties
    if (window.screen) {
      components.push(
        `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}@${window.devicePixelRatio || 1}`
      );
    }

    // Hardware parameters
    if (navigator) {
      components.push(navigator.userAgent || '');
      components.push(navigator.language || '');
      components.push(String(navigator.hardwareConcurrency || ''));
      if ('deviceMemory' in navigator) {
        components.push(String((navigator as unknown as { deviceMemory?: number }).deviceMemory || ''));
      }
      if ('maxTouchPoints' in navigator) {
        components.push(String(navigator.maxTouchPoints || ''));
      }
    }

    // Timezone
    try {
      components.push(Intl.DateTimeFormat().resolvedOptions().timeZone || '');
    } catch {}

    // Canvas signature
    const canvasHash = getCanvasFingerprint();
    if (canvasHash) {
      components.push(canvasHash);
    }

    const rawString = components.join('|||');

    // SHA-256 via SubtleCrypto if available
    if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
      const data = new TextEncoder().encode(rawString);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    // Fallback hash
    return djb2Hash(rawString);
  } catch {
    return '';
  }
}

/**
 * Bundles both persistent UUID and hardware fingerprint for API payload.
 */
export async function getDeviceSecurityPayload(): Promise<{
  deviceId: string;
  deviceFingerprint: string;
}> {
  const deviceId = getOrCreateDeviceId();
  let deviceFingerprint = '';
  try {
    deviceFingerprint = await getDeviceFingerprint();
  } catch {}

  return { deviceId, deviceFingerprint };
}
