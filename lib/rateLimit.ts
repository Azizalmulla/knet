// Use standard Request type to avoid importing next/server in test environment

interface RateLimitData {
  count: number;
  resetTime: number;
}

// In-memory storage for rate limiting (best-effort in serverless; OK for MVP)
const rateLimitStore = new Map<string, RateLimitData>();

// Best-effort idempotency memory (avoid double-counting and duplicate submits)
const idempotencyStore = new Map<string, number>(); // key -> expiry epoch ms

// Configuration
const RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_MAX_REQUESTS = 10;

// Cleanup expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now > data.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

export function getRateLimitKey(request: Request): string {
  // Try multiple IP extraction methods for different deployment environments
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const reqIp = (request as any)?.ip as string | undefined;
  const ip = forwarded?.split(',')[0] || realIp || reqIp || 'unknown';
  
  return `rate_limit:${ip}`;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
}

// Legacy: check + consume in one call (kept for compatibility)
export function checkRateLimit(request: Request): RateLimitResult {
  const key = getRateLimitKey(request);
  const now = Date.now();
  
  let rateLimitData = rateLimitStore.get(key);
  
  // Initialize or reset if expired
  if (!rateLimitData || now > rateLimitData.resetTime) {
    rateLimitData = {
      count: 0,
      resetTime: now + RATE_LIMIT_WINDOW
    };
  }
  
  // Check if limit exceeded
  if (rateLimitData.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      success: false,
      limit: RATE_LIMIT_MAX_REQUESTS,
      remaining: 0,
      resetTime: rateLimitData.resetTime
    };
  }
  
  // Increment count and store
  rateLimitData.count++;
  rateLimitStore.set(key, rateLimitData);
  
  return {
    success: true,
    limit: RATE_LIMIT_MAX_REQUESTS,
    remaining: RATE_LIMIT_MAX_REQUESTS - rateLimitData.count,
    resetTime: rateLimitData.resetTime
  };
}

export function createRateLimitResponse(result: RateLimitResult) {
  return new Response(
    JSON.stringify({ error: 'Too many requests' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(),
        'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString()
      }
    }
  );
}

// New: namespaced, configurable rate limit for per-route policies
export function getRateLimitKeyWithNamespace(request: Request, namespace = 'default'): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const reqIp = (request as any)?.ip as string | undefined;
  const ip = forwarded?.split(',')[0] || realIp || reqIp || 'unknown';
  return `rate_limit:${namespace}:${ip}`;
}

// Back-compat: single-call check that also consumes a token if available
export function checkRateLimitWithConfig(
  request: Request,
  opts: { maxRequests: number; windowMs?: number; namespace?: string; useIp?: boolean }
): RateLimitResult {
  const peek = peekRateLimitWithConfig(request, opts)
  if (!peek.success) return peek
  return consumeRateLimitWithConfig(request, opts)
}

// Peek without consuming (so failed attempts don’t count)
export function peekRateLimitWithConfig(
  request: Request,
  opts: { maxRequests: number; windowMs?: number; namespace?: string; useIp?: boolean }
): RateLimitResult {
  const { maxRequests, windowMs = RATE_LIMIT_WINDOW, namespace = 'custom', useIp = true } = opts;
  const key = useIp ? getRateLimitKeyWithNamespace(request, namespace) : `rate_limit:${namespace}`;
  const now = Date.now();

  let rateLimitData = rateLimitStore.get(key);
  if (!rateLimitData || now > rateLimitData.resetTime) {
    rateLimitData = {
      count: 0,
      resetTime: now + windowMs,
    };
  }

  const remaining = Math.max(0, maxRequests - rateLimitData.count);
  return {
    success: remaining > 0,
    limit: maxRequests,
    remaining,
    resetTime: rateLimitData.resetTime,
  };
}

// Consume 1 token (call this only after success)
export function consumeRateLimitWithConfig(
  request: Request,
  opts: { maxRequests: number; windowMs?: number; namespace?: string; useIp?: boolean }
): RateLimitResult {
  const { maxRequests, windowMs = RATE_LIMIT_WINDOW, namespace = 'custom', useIp = true } = opts;
  const key = useIp ? getRateLimitKeyWithNamespace(request, namespace) : `rate_limit:${namespace}`;
  const now = Date.now();

  let rateLimitData = rateLimitStore.get(key);
  if (!rateLimitData || now > rateLimitData.resetTime) {
    rateLimitData = {
      count: 0,
      resetTime: now + windowMs,
    };
  }

  if (rateLimitData.count >= maxRequests) {
    return {
      success: false,
      limit: maxRequests,
      remaining: 0,
      resetTime: rateLimitData.resetTime,
    };
  }

  rateLimitData.count++;
  rateLimitStore.set(key, rateLimitData);
  return {
    success: true,
    limit: maxRequests,
    remaining: maxRequests - rateLimitData.count,
    resetTime: rateLimitData.resetTime,
  };
}

// Idempotency helpers (best-effort)
export function shouldSkipRateLimitForIdempotency(idKey: string, windowMs = 30_000): boolean {
  const now = Date.now();
  const exp = idempotencyStore.get(idKey);
  if (typeof exp === 'number' && exp > now) {
    return true;
  }
  idempotencyStore.set(idKey, now + windowMs);
  return false;
}
