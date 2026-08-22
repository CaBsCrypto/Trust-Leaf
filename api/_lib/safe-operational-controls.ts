const SENSITIVE_KEY = /(?:authorization|cookie|token|secret|password|email|name|rut|address|payload|ciphertext|wrapped)/i;
const SECRET_VALUE = /(?:Bearer\s+[A-Za-z0-9._~+/=-]+|S[A-Z0-9]{55}|G[A-Z0-9]{55})/gi;

export function redactForLog(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[REDACTED_DEPTH]';
  if (typeof value === 'string') return value.replace(SECRET_VALUE, '[REDACTED]');
  if (Array.isArray(value)) return value.map(item => redactForLog(item, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SENSITIVE_KEY.test(key) ? '[REDACTED]' : redactForLog(item, depth + 1)]));
  return value;
}

export interface RateLimitDecision { allowed: boolean; retryAfterMs: number; remaining: number }
export function createFixedWindowRateLimiter(limit: number, windowMs: number, maxSubjects = 10_000) {
  if (!Number.isInteger(limit) || limit < 1 || windowMs < 1 || maxSubjects < 1) throw new Error('INVALID_RATE_LIMIT_CONFIG');
  const buckets = new Map<string, { start: number; count: number }>();
  return {
    check(subject: string, nowMs: number): RateLimitDecision {
      if (!subject || subject.length > 256) return { allowed: false, retryAfterMs: windowMs, remaining: 0 };
      let bucket = buckets.get(subject);
      if (!bucket || nowMs >= bucket.start + windowMs) { if (!bucket && buckets.size >= maxSubjects) return { allowed: false, retryAfterMs: windowMs, remaining: 0 }; bucket = { start: nowMs, count: 0 }; buckets.set(subject, bucket); }
      if (bucket.count >= limit) return { allowed: false, retryAfterMs: Math.max(1, bucket.start + windowMs - nowMs), remaining: 0 };
      bucket.count += 1; return { allowed: true, retryAfterMs: 0, remaining: limit - bucket.count };
    },
  };
}
