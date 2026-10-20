// In-memory sliding-window rate limiter for public endpoints

interface RateLimitRecord {
  timestamps: number[];
}

const ipMap = new Map<string, RateLimitRecord>();

// Clean up old entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of ipMap.entries()) {
      record.timestamps = record.timestamps.filter((t) => now - t < 60000);
      if (record.timestamps.length === 0) ipMap.delete(ip);
    }
  }, 300000);
}

export function checkRateLimit(
  ip: string,
  limit = 20,
  windowMs = 60000
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  let record = ipMap.get(ip);
  if (!record) {
    record = { timestamps: [] };
    ipMap.set(ip, record);
  }

  // Filter timestamps within the sliding window
  record.timestamps = record.timestamps.filter((t) => now - t < windowMs);

  if (record.timestamps.length >= limit) {
    return { allowed: false, remaining: 0 };
  }

  record.timestamps.push(now);
  return { allowed: true, remaining: limit - record.timestamps.length };
}
