// ---------------------------------------------------------------------------
// In-memory rate limiter (per dev instance — SQLite-scale, no middleware).
// Buckets are keyed arbitrarily (e.g. `login:ip:email`) and swept lazily.
// ---------------------------------------------------------------------------

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_BUCKETS = 10_000;

function sweep(now: number): void {
  if (buckets.size < MAX_TRACKED_BUCKETS) {
    for (const [key, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(key);
    }
  } else {
    // Under pressure, drop everything expired-or-oldest rather than grow.
    buckets.clear();
  }
}

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  if (existing.count >= limit) {
    return { ok: false, retryAfterSec: Math.ceil((existing.resetAt - now) / 1000) };
  }
  existing.count += 1;
  return { ok: true, retryAfterSec: 0 };
}

/** Best-effort client IP behind the gateway proxy chain. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}
