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

import { POST } from '@/app/api/ai/career-assistant/route'

// Mock rate limit helpers
jest.mock('@/lib/rateLimit', () => ({
  checkRateLimitWithConfig: jest.fn().mockReturnValue({ success: true, limit: 10, remaining: 9, resetTime: Date.now() + 300000 }),
  createRateLimitResponse: jest.fn().mockReturnValue(new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429 })),
}))

const { checkRateLimitWithConfig, createRateLimitResponse } = require('@/lib/rateLimit')

// Helper to create a mock NextRequest-like object
const createPostRequest = (body: any): any => {
  return {
    headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
    json: async () => body,
    method: 'POST',
    url: 'http://localhost:3000/api/ai/career-assistant',
  } as any
}

describe('/api/ai/career-assistant', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('returns 422 with needs when required info is missing (mode: complete)', async () => {
    const req = createPostRequest({
      mode: 'complete',
      locale: 'en',
      tone: 'professional',
      form: { personalInfo: {} },
    })

    const res = await POST(req)
    expect(res.status).toBe(422)
    const data = await res.json()
    expect(Array.isArray(data.needs)).toBe(true)
    expect(data.needs).toEqual(expect.arrayContaining(['personalInfo.fullName', 'personalInfo.email']))
  })

  test('optimizes and localizes bullets to Arabic (mode: optimize)', async () => {
    const req = createPostRequest({
      mode: 'optimize',
      locale: 'ar',
      tone: 'professional',
      form: {
        personalInfo: { fullName: 'Aziz', email: 'aziz@example.com' },
        experience: [
          { title: 'Developer', bullets: ['Developed UI components'] }
        ],
      },
      jobDescription: 'React TypeScript Next.js',
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.cv).toBeDefined()
    expect(data.cv.experience[0].bullets[0]).toMatch(/^طوّرت/)
  })

  test('returns 429 when rate limited', async () => {
    ;(checkRateLimitWithConfig as jest.Mock).mockReturnValueOnce({ success: false, limit: 10, remaining: 0, resetTime: Date.now() + 300000 })
    const req = createPostRequest({ mode: 'complete', locale: 'en', tone: 'professional', form: { personalInfo: { fullName: 'A', email: 'a@b.com' } } })
    const res = await POST(req)

    expect(createRateLimitResponse).toHaveBeenCalled()
    expect(res.status).toBe(429)
  })
})
