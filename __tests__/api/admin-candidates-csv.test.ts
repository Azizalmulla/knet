/**
 * @jest-environment node
 */

// Avoid loading real next/server runtime
jest.mock('next/server', () => ({ NextRequest: class {} }))

// Allow rate limit
jest.mock('@/lib/rateLimit', () => ({
  checkRateLimitWithConfig: jest.fn().mockReturnValue({ success: true, limit: 1, remaining: 1, resetTime: Date.now() + 60000 }),
  createRateLimitResponse: jest.fn().mockReturnValue(new Response('Rate limited', { status: 429 }))
}))

// Mock @vercel/postgres (template tag + .query)
const mockSqlTag = jest.fn(async () => ({ rows: [{ id: 'org-uuid', slug: 'knet' }] }))
const mockQuery = jest.fn()
jest.mock('@vercel/postgres', () => {
  const tag: any = function(strings: TemplateStringsArray) {
    const args: any[] = Array.prototype.slice.call(arguments)
    return (mockSqlTag as any).apply(null, args)
  }
  tag.query = function() {
    const args: any[] = Array.prototype.slice.call(arguments)
    return (mockQuery as any).apply(null, args)
  }
  return { sql: tag }
})

import { GET } from '@/app/api/[org]/admin/export/candidates.csv/route'

describe('GET /api/[org]/admin/export/candidates.csv', () => {

  beforeEach(() => {
    jest.clearAllMocks()
  })

  function makeReq(url: string): any {
    return { url, headers: new Map([['x-forwarded-for','127.0.0.1']]) } as any
  }

  test('includes taxonomy headers in CSV', async () => {
    // Arrange: one fake row from SQL (matching selectSQL columns)
    mockQuery
      .mockResolvedValueOnce({ rows: [
        {
          name: 'Alice',
          email: 'alice@example.com',
          phone: '',
          field_of_study: 'CS',
          area_of_interest: 'Web',
          degree: 'Bachelor',
          yoe: 'Junior',
          degree_level: 'Bachelor',
          major_slug: 'computer_science',
          area_slug: 'web',
          yoe_bucket: '0–1',
          taxonomy_version: 'v1',
          cv_type: 'uploaded',
          parse_status: 'done',
          submitted_at: new Date().toISOString(),
          org_slug: 'knet'
        }
      ] })
      // second chunk empty
      .mockResolvedValueOnce({ rows: [] })

    const res = await GET(makeReq('http://localhost/api/knet/admin/export/candidates.csv'), { params: { org: 'knet' } })
    expect(res.status).toBe(200)
    const csv = await res.text()
    // Assert header contains canonical taxonomy columns
    expect(csv.split('\n')[0]).toContain('degree_level,major_slug,area_slug,yoe_bucket,taxonomy_version,cv_type,parse_status,submitted_at,org_slug')
  })
})
