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

// Mock Blob upload
jest.mock('@vercel/blob', () => ({
  put: jest.fn().mockResolvedValue({ url: 'https://blob.example.com/fake.html' }),
}))

// Mock DB client
jest.mock('@vercel/postgres', () => ({
  sql: jest.fn().mockImplementation(async () => ({ rows: [{ id: 1 }] })),
}))

// Mock rate limiting to always allow
jest.mock('@/lib/rateLimit', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ success: true, limit: 5, remaining: 5, resetTime: Date.now() + 300000 }),
  createRateLimitResponse: jest.fn().mockReturnValue(new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429 })),
}))

import { POST } from '@/app/api/cv/submit/route'

const createPostRequest = (body: any): any => ({
  headers: new Headers({ 'x-forwarded-for': '127.0.0.1' }),
  json: async () => body,
  method: 'POST',
  url: 'http://localhost:3000/api/cv/submit',
})

describe('/api/cv/submit — knetProfile integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('returns 400 when knetProfile is missing (AI builder path)', async () => {
    const req = createPostRequest({
      fullName: 'Aziz',
      email: 'aziz@example.com',
      fieldOfStudy: 'Computer Science',
      areaOfInterest: 'IT',
      template: 'minimal',
      language: 'en',
      suggestedVacancies: 'Developer/Support',
    })

    const res = await POST(req as any)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/knetProfile/i)
  })

  test('logs normalization diff when selections require normalization', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

    const req = createPostRequest({
      fullName: 'Aziz',
      email: 'aziz@example.com',
      phone: '+965 555',
      fieldOfStudy: 'Computer Science',
      areaOfInterest: 'Information Technology', // will normalize to IT
      template: 'minimal',
      language: 'en',
      suggestedVacancies: 'Developer/Support',
      knetProfile: {
        degreeBucket: 'Bachelor’s',
        yearsOfExperienceBucket: '0–1',
        areaOfInterest: 'Information Technology',
      },
      experience: [],
      projects: [],
      education: [],
      skills: { technical: ['JS'] },
    })

    const res = await POST(req as any)
    expect(res.status).toBe(200)
    const content = await res.json()
    expect(content.ok).toBe(true)

    const calls = logSpy.mock.calls
    const hasDiffLog = calls.some(
      (args) => args[0] === 'knet_profile_normalized_diff' && args[1] && args[1].fields && args[1].fields.includes('areaOfInterest')
    )
    expect(hasDiffLog).toBe(true)

    logSpy.mockRestore()
  })
})
