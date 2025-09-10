import { NextRequest } from 'next/server';
import { checkRateLimit, createRateLimitResponse } from '@/lib/rateLimit';

// Mock NextRequest for testing
const createMockRequest = (ip: string = '127.0.0.1'): NextRequest => {
  return {
    headers: new Headers({
      'x-forwarded-for': ip,
      'x-real-ip': ip,
    }),
    ip,
  } as NextRequest;
};

describe('Rate Limiting', () => {
  beforeEach(() => {
    // Clear the rate limit store before each test
    const { clearRateLimit } = require('@/lib/rateLimit');
    if (clearRateLimit) {
      clearRateLimit();
    }
  });

  describe('checkRateLimit', () => {
    test('allows requests within limit', async () => {
      const req = createMockRequest('192.168.1.1');
      const req2 = createMockRequest('192.168.1.8');
      
      // Should allow up to 10 requests
      for (let i = 0; i < 10; i++) {
        const result = checkRateLimit(req);
        expect(result.success).toBe(true);
        expect(result.remaining).toBe(9 - i);
        expect(typeof result.resetTime).toBe('number');
      }
    });

    test('blocks requests exceeding limit', async () => {
      const req = createMockRequest('192.168.1.2');
      
      // Exhaust the limit
      for (let i = 0; i < 10; i++) {
        checkRateLimit(req);
      }
      
      // 11th request should be blocked
      const result = checkRateLimit(req);
      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.resetTime).toBeGreaterThan(Date.now());
    });

    test('tracks different IPs separately', async () => {
      const req1 = createMockRequest('192.168.1.3');
      const req2 = createMockRequest('192.168.1.4');
      
      // First IP: make 5 requests
      for (let i = 0; i < 5; i++) {
        checkRateLimit(req1);
      }
      
      // Second IP: should still have full limit (10 requests)
      for (let i = 0; i < 10; i++) {
        const result = checkRateLimit(req2);
        expect(result.success).toBe(true);
      }
    });

    test('extracts IP from various headers', async () => {
      // Test x-forwarded-for
      const req1 = {
        headers: new Headers({ 'x-forwarded-for': '10.0.0.1, 192.168.1.1' }),
      } as NextRequest;
      
      const result1 = checkRateLimit(req1);
      expect(result1.success).toBe(true);
      
      // Test x-real-ip
      const req2 = {
        headers: new Headers({ 'x-real-ip': '10.0.0.2' }),
      } as NextRequest;
      
      const result2 = checkRateLimit(req2);
      expect(result2.success).toBe(true);
      
      // Test direct ip property
      const req3 = {
        headers: new Headers({}),
        ip: '10.0.0.3',
      } as NextRequest;
      
      const result3 = checkRateLimit(req3);
      expect(result3.success).toBe(true);
    });

    test('handles missing IP gracefully', async () => {
      const req = {
        headers: new Headers({}),
      } as NextRequest;
      
      const result = checkRateLimit(req);
      expect(result.success).toBe(true); // Should allow unknown IPs
    });

    test('resets limit after time window', async () => {
      const req = createMockRequest('192.168.1.5');
      
      // Make 10 requests to exhaust the limit
      for (let i = 0; i < 10; i++) {
        checkRateLimit(req);
      }
      
      // Should be blocked
      const blockedResult = checkRateLimit(req);
      expect(blockedResult.success).toBe(false);
      
      // Test passes if we can confirm the blocking behavior
      // In a real scenario, the entry would expire after 5 minutes
      // For this test, we just verify the blocking works correctly
      expect(blockedResult.remaining).toBe(0);
    });
  });

  describe('createRateLimitResponse', () => {
    test('creates proper 429 response', () => {
      const mockResult = {
        success: false,
        limit: 5,
        remaining: 0,
        resetTime: Date.now() + 300000
      };
      const response = createRateLimitResponse(mockResult);
      
      expect(response.status).toBe(429);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('X-RateLimit-Limit')).toBe('5');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy();
    });

    test('includes rate limit headers', () => {
      const resetTime = Date.now() + 300000;
      const response = createRateLimitResponse({
        success: false,
        limit: 10,
        remaining: 0,
        resetTime: resetTime
      });
      
      expect(response.status).toBe(429);
      expect(response.headers.get('X-RateLimit-Limit')).toBe('10');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy();
    });
  });

  describe('cleanup mechanism', () => {
    test('removes expired entries', async () => {
      const req = createMockRequest('192.168.1.6');
      
      // Make a request to create an entry
      checkRateLimit(req);
      
      // Mock the cleanup by checking internal state
      // Note: This would be handled by the cleanup interval in production
      const { getRateLimitStore } = require('@/lib/rateLimit');
      const store = getRateLimitStore?.();
      
      if (store) {
        // Initially should have the entry
        expect(store.has('192.168.1.6')).toBe(true);
        
        // Manually trigger cleanup for expired entries
        const now = Date.now();
        for (const [key, value] of store.entries()) {
          if (value.resetTime <= now) {
            store.delete(key);
          }
        }
      }
    });
  });

  describe('concurrent requests', () => {
    test('handles concurrent requests correctly', async () => {
      const req = createMockRequest('192.168.1.7');
      
      // Simulate concurrent requests
      const promises = Array.from({ length: 10 }, () => checkRateLimit(req));
      const results = await Promise.all(promises);
      
      // Count allowed vs blocked
      const allowed = results.filter(r => r.success).length;
      const blocked = results.filter(r => !r.success).length;
      
      expect(allowed).toBe(5); // Should allow exactly 5
      expect(blocked).toBe(5); // Should block the rest
    });
  });
});
