/**
 * @jest-environment node
 */
// Mock Next.js server module to avoid requiring global Request polyfills
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, init?: { status?: number; headers?: Record<string, string> }) =>
      new Response(JSON.stringify(data), {
        status: init?.status ?? 200,
        headers: init?.headers ?? { 'Content-Type': 'application/json' },
      }),
  },
}))
import { GET } from '@/app/api/telemetry/top/route';

// Mock dependencies
jest.mock('@/lib/rateLimit', () => ({
  checkRateLimit: jest.fn(),
  createRateLimitResponse: jest.fn()
}));

jest.mock('@/lib/db-client', () => ({
  getDbClient: jest.fn()
}));

jest.mock('@/lib/redact', () => ({
  safeError: jest.fn()
}));

const mockCheckRateLimit = require('@/lib/rateLimit').checkRateLimit;
const mockCreateRateLimitResponse = require('@/lib/rateLimit').createRateLimitResponse;
const mockGetDbClient = require('@/lib/db-client').getDbClient;
const mockSafeError = require('@/lib/redact').safeError;

// Mock database client
const mockDbClient = {
  query: jest.fn()
};

const createMockRequest = (url: string = 'http://localhost:3000/api/telemetry/top'): any => {
  return {
    url,
    method: 'GET',
    headers: new Headers(),
  } as any;
};

describe('/api/telemetry/top', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDbClient.mockReturnValue(mockDbClient);
    mockCheckRateLimit.mockReturnValue({ success: true, limit: 5, remaining: 5, resetTime: Date.now() + 300000 });
  });

  test('returns top field/area combinations successfully', async () => {
    const mockCombos = [
      { field_of_study: 'Computer Science', area_of_interest: 'Software Development', count: '25', percentage: '50.00' },
      { field_of_study: 'Business', area_of_interest: 'Marketing', count: '15', percentage: '30.00' },
      { field_of_study: 'Engineering', area_of_interest: 'Technology', count: '10', percentage: '20.00' }
    ];

    const mockTotal = [{ total: '50' }];

    mockDbClient.query
      .mockResolvedValueOnce({ rows: mockCombos })
      .mockResolvedValueOnce({ rows: mockTotal });

    const request = createMockRequest();
    const response = await GET(request);
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.combos).toHaveLength(3);
    expect(data.data.combos[0]).toEqual({
      field_of_study: 'Computer Science',
      area_of_interest: 'Software Development',
      count: 25,
      percentage: 50.00
    });
    expect(data.data.totalSubmissions).toBe(50);
    expect(data.data.limit).toBe(10);
    expect(data.data.generatedAt).toBeDefined();
  });

  test('respects custom limit parameter', async () => {
    mockDbClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] });

    const request = createMockRequest('http://localhost:3000/api/telemetry/top?limit=5');
    await GET(request);

    // Check that limit 5 was passed to the database query
    expect(mockDbClient.query).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT $1'),
      [5]
    );
  });

  test('enforces maximum limit of 50', async () => {
    mockDbClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] });

    const request = createMockRequest('http://localhost:3000/api/telemetry/top?limit=100');
    await GET(request);

    // Should cap at 50
    expect(mockDbClient.query).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT $1'),
      [50]
    );
  });

  test('handles invalid limit gracefully', async () => {
    mockDbClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] });

    const request = createMockRequest('http://localhost:3000/api/telemetry/top?limit=invalid');
    await GET(request);

    // Should default to 10
    expect(mockDbClient.query).toHaveBeenCalledWith(
      expect.stringContaining('LIMIT $1'),
      [10]
    );
  });

  test('returns 429 when rate limited', async () => {
    const rl = { success: false, limit: 5, remaining: 0, resetTime: Date.now() + 300000 };
    mockCheckRateLimit.mockReturnValue(rl);
    mockCreateRateLimitResponse.mockReturnValue(new Response(
      JSON.stringify({ error: 'Too many requests' }),
      { status: 429 }
    ));

    const request = createMockRequest();
    const response = await GET(request);

    expect(mockCreateRateLimitResponse).toHaveBeenCalledWith(rl);
    expect(response.status).toBe(429);
  });

  test('handles database errors gracefully', async () => {
    mockDbClient.query.mockRejectedValue(new Error('Database connection failed'));

    const request = createMockRequest();
    const response = await GET(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('Failed to fetch telemetry data');
    expect(mockSafeError).toHaveBeenCalledWith(
      'TELEMETRY_API_ERROR',
      expect.any(Error),
      expect.objectContaining({
        url: expect.stringContaining('/api/telemetry/top'),
        method: 'GET'
      })
    );
  });

  test('handles empty results', async () => {
    mockDbClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] });

    const request = createMockRequest();
    const response = await GET(request);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.combos).toEqual([]);
    expect(data.data.totalSubmissions).toBe(0);
  });

  test('handles null total count', async () => {
    mockDbClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: null }] });

    const request = createMockRequest();
    const response = await GET(request);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data.totalSubmissions).toBe(0);
  });

  test('uses correct SQL query for combinations', async () => {
    mockDbClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] });

    const request = createMockRequest();
    await GET(request);

    const [combinationsCall] = mockDbClient.query.mock.calls;
    const [query, params] = combinationsCall;
    
    expect(query).toContain('SELECT');
    expect(query).toContain('field_of_study');
    expect(query).toContain('area_of_interest');
    expect(query).toContain('COUNT(*) as count');
    expect(query).toContain('GROUP BY field_of_study, area_of_interest');
    expect(query).toContain('ORDER BY count DESC');
    expect(query).toContain('LIMIT $1');
    expect(params).toEqual([10]);
  });

  test('calculates percentages correctly', async () => {
    const mockCombos = [
      { field_of_study: 'CS', area_of_interest: 'Tech', count: '30', percentage: '60.00' },
      { field_of_study: 'Business', area_of_interest: 'Sales', count: '20', percentage: '40.00' }
    ];

    mockDbClient.query
      .mockResolvedValueOnce({ rows: mockCombos })
      .mockResolvedValueOnce({ rows: [{ total: '50' }] });

    const request = createMockRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(data.data.combos[0].percentage).toBe(60.00);
    expect(data.data.combos[1].percentage).toBe(40.00);
  });

  test('filters out null and empty values', async () => {
    const request = createMockRequest();
    await GET(request);

    const [combinationsCall] = mockDbClient.query.mock.calls;
    const [query] = combinationsCall;
    
    expect(query).toContain('WHERE field_of_study IS NOT NULL');
    expect(query).toContain('AND area_of_interest IS NOT NULL');
    expect(query).toContain("AND field_of_study != ''");
    expect(query).toContain("AND area_of_interest != ''");
  });
});
