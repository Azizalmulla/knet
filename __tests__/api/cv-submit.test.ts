/**
 * @jest-environment node
 */

// Mock Next.js response helper
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, init?: { status?: number; headers?: Record<string, string> }) =>
      new Response(JSON.stringify(data), {
        status: init?.status ?? 200,
        headers: init?.headers ?? { 'Content-Type': 'application/json' },
      }),
  },
}))

// Mock Supabase server client to simulate a logged-in user
jest.mock('@/lib/supabase-server', () => ({
  createServerClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { email: 'test@example.com' } } }),
    },
  })),
}))

// Mock DB layer used by /api/submit
jest.mock('@/lib/db', () => {
  const handler = async (...args: any[]) => {
    const [strings] = args
    const text = Array.isArray(strings) ? strings.join('') : String(strings || '')
    if (text.includes("to_regclass('public.organizations')")) return { rows: [{ c: 'public.organizations' }] }
    if (text.includes("to_regclass('public.candidates')")) return { rows: [{ c: 'public.candidates' }] }
    if (text.includes("to_regtype('yoe_bucket')")) return { rows: [{ t: 'yoe_bucket' }] }
    if (text.includes("to_regtype('cv_type_enum')")) return { rows: [{ t: 'cv_type_enum' }] }
    if (text.includes("to_regtype('parse_status_enum')")) return { rows: [{ t: 'parse_status_enum' }] }
    if (text.includes('SELECT COUNT(*)::int as c FROM organizations')) return { rows: [{ c: 1 }] }
    if (text.includes('FROM organizations WHERE slug =')) return { rows: [{ id: '11111111-1111-1111-1111-111111111111', name: 'Wathefni AI' }] }
    if (text.includes('INSERT INTO public.candidates')) return { rows: [{ id: '00000000-0000-0000-0000-000000000001', created_at: new Date().toISOString(), parse_status: 'completed', cv_type: 'ai_generated' }] }
    if (text.includes('SELECT 1 FROM public.candidates WHERE id =')) return { rows: [{ ok: 1 }] }
    return { rows: [] }
  }
  return {
    sql: jest.fn(handler),
    getDbInfo: jest.fn(() => ({ host: 'localhost', db: 'testdb' })),
  }
})

// Mock rate limiting to always allow
jest.mock('@/lib/rateLimit', () => ({
  peekRateLimitWithConfig: jest.fn().mockReturnValue({ success: true, limit: 10, remaining: 10, resetTime: Date.now() + 60000 }),
  consumeRateLimitWithConfig: jest.fn(),
  shouldSkipRateLimitForIdempotency: jest.fn().mockReturnValue(false),
}))

import { POST } from '@/app/api/submit/route'

const createPostRequest = (body: any): any => ({
  headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
  json: async () => body,
  method: 'POST',
  url: 'http://localhost:3000/api/submit',
})

describe('/api/submit — multi-tenant candidate submission', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('returns 400 when organization slug is missing', async () => {
    const req = createPostRequest({
      fullName: 'Aziz',
      fieldOfStudy: 'Computer Science',
      areaOfInterest: 'IT',
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(String(data.error || '')).toMatch(/organization/i)
  })

  test('succeeds when orgSlug provided and user is logged in', async () => {
    const req = createPostRequest({
      fullName: 'Aziz',
      fieldOfStudy: 'Computer Science',
      areaOfInterest: 'IT',
      orgSlug: 'careerly',
      cvType: 'ai',
    })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.candidate_id).toBeDefined()
  })
})
