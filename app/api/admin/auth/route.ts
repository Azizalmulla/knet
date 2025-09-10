import { checkRateLimit, createRateLimitResponse } from '@/lib/rateLimit';
import { safeLog } from '@/lib/redact';
import type { NextRequest } from 'next/server';

export async function POST(req: Request) {
  // Apply rate limiting for admin auth using global checkRateLimit
  const rateLimitResult = checkRateLimit(req as unknown as NextRequest);
  if (!rateLimitResult.success) {
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    safeLog('ADMIN_AUTH_RATE_LIMITED', { 
      ip: clientIP.split(',')[0].trim(),
      timestamp: new Date().toISOString(),
    });
    return createRateLimitResponse(rateLimitResult);
  }

  const { token } = await req.json().catch(() => ({}));
  const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const logData = {
    ip: clientIP.split(',')[0].trim(),
    timestamp: new Date().toISOString()
  };
  
  if (!token || token !== process.env.ADMIN_KEY) {
    safeLog('ADMIN_LOGIN_FAIL', logData);
    return new Response(JSON.stringify({ ok: false }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  safeLog('ADMIN_LOGIN_OK', logData);
  return new Response(JSON.stringify({ ok: true }), { 
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
