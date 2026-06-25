import { type Request, type Response, type NextFunction } from "express";

/**
 * Tiny in-memory token-bucket rate limiter. For a single-instance dev server
 * this is more than enough. For production we'd swap this for a Redis-backed
 * implementation, but the interface (req, res, next) stays the same.
 *
 * Buckets are keyed by an arbitrary string (typically `${req.ip}:${key}`).
 * Old entries are pruned on every request to keep memory bounded.
 */

interface Bucket {
  // Sliding window: number of hits in the current window, and the window's
  // start time in epoch ms. Window resets when the difference exceeds `windowMs`.
  count: number;
  windowStart: number;
}

interface RateLimitOptions {
  /** Maximum requests per window. */
  limit: number;
  /** Window size in milliseconds. */
  windowMs: number;
  /** Optional key suffix so two rate limits can coexist. */
  key?: string;
}

const buckets = new Map<string, Bucket>();

// Periodically prune old buckets. 60s cadence is plenty.
const PRUNE_INTERVAL_MS = 60_000;
const pruneTimer = setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) {
    if (now - b.windowStart > 5 * 60_000) buckets.delete(k);
  }
}, PRUNE_INTERVAL_MS);
pruneTimer.unref?.();

export function rateLimit(opts: RateLimitOptions) {
  const { limit, windowMs, key = "default" } = opts;
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";
    const bucketKey = `${ip}:${key}`;
    const now = Date.now();
    let bucket = buckets.get(bucketKey);
    if (!bucket || now - bucket.windowStart > windowMs) {
      bucket = { count: 0, windowStart: now };
      buckets.delete(bucketKey); // safety
    }
    bucket.count += 1;
    buckets.set(bucketKey, bucket);

    const remaining = Math.max(0, limit - bucket.count);
    const resetIn = Math.max(0, windowMs - (now - bucket.windowStart));
    res.setHeader("X-RateLimit-Limit", String(limit));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(resetIn / 1000)));

    if (bucket.count > limit) {
      res.status(429).json({
        error: "Too many requests. Please try again later.",
        retryAfter: Math.ceil(resetIn / 1000),
      });
      return;
    }
    next();
  };
}
