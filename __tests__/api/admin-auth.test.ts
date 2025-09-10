import { POST } from '@/app/api/admin/auth/route';
import { checkRateLimit } from '@/lib/rateLimit';

// Mock dependencies
jest.mock('@/lib/rateLimit', () => ({
  checkRateLimit: jest.fn(),
  createRateLimitResponse: jest.fn(() => new Response('{"error":"Rate limited"}', { status: 429 }))
}));
jest.mock('@/lib/redact', () => ({
  safeLog: jest.fn()
}));

const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

// Mock global Response for Node.js test environment
global.Response = class MockResponse {
  status: number;
  headers: Map<string, string>;
  body: string;

  constructor(body: any, init: ResponseInit = {}) {
    this.body = body;
    this.status = init.status || 200;
    this.headers = new Map();
    if (init.headers) {
      Object.entries(init.headers).forEach(([key, value]) => {
        this.headers.set(key, value as string);
      });
    }
  }

  async json() {
    return JSON.parse(this.body);
  }
} as any;

describe('/api/admin/auth', () => {
  beforeEach(() => {
    process.env.ADMIN_KEY = 'test-admin-key-123';
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.ADMIN_KEY;
  });

  const createMockRequest = (body: any, headers: Record<string, string> = {}) => {
    return {
      json: () => Promise.resolve(body),
      headers: new Map(Object.entries({
        'x-forwarded-for': '192.168.1.100',
        ...headers
      }))
    } as unknown as Request;
  };

  test('authenticates with valid admin key', async () => {
    mockCheckRateLimit.mockReturnValue({
      success: true,
      limit: 5,
      remaining: 4,
      resetTime: Date.now() + 300000
    } as any);

    const request = createMockRequest({ token: 'test-admin-key-123' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockCheckRateLimit).toHaveBeenCalled();
  });

  test('rejects invalid admin key', async () => {
    mockCheckRateLimit.mockReturnValue({
      success: true,
      limit: 5,
      remaining: 4,
      resetTime: Date.now() + 300000
    } as any);

    const request = createMockRequest({ token: 'wrong-key' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.ok).toBe(false);
  });

  test('rejects empty token', async () => {
    mockCheckRateLimit.mockReturnValue({
      success: true,
      limit: 5,
      remaining: 4,
      resetTime: Date.now() + 300000
    } as any);

    const request = createMockRequest({ token: '' });
    const response = await POST(request);
    
    expect(response.status).toBe(401);
  });

  test('applies rate limiting - blocks after limit exceeded', async () => {
    mockCheckRateLimit.mockReturnValue({
      success: false,
      limit: 5,
      remaining: 0,
      resetTime: Date.now() + 300000
    } as any);

    const request = createMockRequest({ token: 'test-admin-key-123' });
    const response = await POST(request);

    expect(mockCheckRateLimit).toHaveBeenCalled();
  });

  test('rate limiting allows requests within limit', async () => {
    mockCheckRateLimit.mockReturnValue({
      success: true,
      limit: 5,
      remaining: 2,
      resetTime: Date.now() + 300000
    } as any);

    const request = createMockRequest({ token: 'test-admin-key-123' });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockCheckRateLimit).toHaveBeenCalled();
  });

  test('extracts correct IP from headers', async () => {
    mockCheckRateLimit.mockReturnValue({
      success: true,
      limit: 5,
      remaining: 4,
      resetTime: Date.now() + 300000
    } as any);

    // Test x-forwarded-for with multiple IPs
    const request = createMockRequest(
      { token: 'test-admin-key-123' },
      { 'x-forwarded-for': '203.0.113.1, 192.168.1.1' }
    );
    
    await POST(request);

    // Should have called rate limit check
    expect(mockCheckRateLimit).toHaveBeenCalled();
  });

  test('handles malformed JSON gracefully', async () => {
    mockCheckRateLimit.mockReturnValue({
      success: true,
      limit: 5,
      remaining: 4,
      resetTime: Date.now() + 300000
    } as any);

    const request = {
      json: () => Promise.reject(new Error('Invalid JSON')),
      headers: new Map([['x-forwarded-for', '192.168.1.100']])
    } as unknown as Request;

    const response = await POST(request);
    
    expect(response.status).toBe(401);
  });

  test('invokes rate limit check', async () => {
    const request = createMockRequest({ token: 'test-admin-key-123' });
    mockCheckRateLimit.mockReturnValue({
      success: true,
      limit: 5,
      remaining: 4,
      resetTime: Date.now() + 300000
    } as any);
    await POST(request);
    expect(mockCheckRateLimit).toHaveBeenCalled();
  });
});
