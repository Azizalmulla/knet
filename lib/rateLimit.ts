import { NextRequest } from 'next/server';

interface RateLimitData {
  count: number;
  resetTime: number;
}

// In-memory storage for rate limiting (edge-safe for MVP)
const rateLimitStore = new Map<string, RateLimitData>();

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

export function getRateLimitKey(request: NextRequest): string {
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

export function checkRateLimit(request: NextRequest): RateLimitResult {
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
export function getRateLimitKeyWithNamespace(request: NextRequest, namespace = 'default'): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const reqIp = (request as any)?.ip as string | undefined;
  const ip = forwarded?.split(',')[0] || realIp || reqIp || 'unknown';
  return `rate_limit:${namespace}:${ip}`;
}

export function checkRateLimitWithConfig(
  request: NextRequest,
  opts: { maxRequests: number; windowMs?: number; namespace?: string }
): RateLimitResult {
  const { maxRequests, windowMs = RATE_LIMIT_WINDOW, namespace = 'custom' } = opts;
  const key = getRateLimitKeyWithNamespace(request, namespace);
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
