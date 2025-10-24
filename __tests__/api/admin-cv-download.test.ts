/**
 * @jest-environment node
 */

import { GET } from '@/app/api/[org]/admin/cv/download/route'

// Allow rate limit
jest.mock('@/lib/rateLimit', () => ({
  checkRateLimitWithConfig: jest.fn().mockReturnValue({ success: true, limit: 20, remaining: 19, resetTime: Date.now() + 60000 }),
  createRateLimitResponse: jest.fn().mockReturnValue(new Response('Rate limited', { status: 429 }))
}))

// Mock @vercel/postgres (template tag + .query)
const mockSqlTag = jest.fn(async () => ({ rows: [] as any[] }))
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

// Mock storage presign
jest.mock('@/lib/storage', () => ({ getPresignedUrl: jest.fn() }))
const { getPresignedUrl } = require('@/lib/storage') as { getPresignedUrl: jest.Mock }

function makeReq(url: string): any {
  return { url, headers: new Map([['x-forwarded-for','127.0.0.1']]) } as any
}

describe('GET /api/[org]/admin/cv/download', () => {
  const org = 'knet'
  const candidateId = 'uuid-1'
  const key = 'objs/key1.pdf'

  beforeEach(() => {
    jest.clearAllMocks()
    // SQL select returns candidate row with key
    mockSqlTag.mockResolvedValueOnce({ rows: [{ id: candidateId, full_name: 'Alice Smith', key, org_id: 'org-uuid' }] })
  })

  test('happy path: streams PDF with content-disposition', async () => {
    // First presign
    getPresignedUrl.mockResolvedValueOnce({ url: 'https://blob.example.com/ok', expiresAt: Date.now() + 60000 })
    // Upstream fetch OK
    const pdfBody = 'PDFDATA'
    const fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValue(new Response(pdfBody, { status: 200 }))

    const res = await GET(makeReq(`http://localhost/api/${org}/admin/cv/download?candidateId=${candidateId}`), { params: { org } })
    expect(res.status).toBe(200)
    const body = await res.text()
    expect(body).toBe(pdfBody)
    expect(getPresignedUrl).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    fetchMock.mockRestore()
  })

  test('expired link retry: first fetch fails, second presign succeeds', async () => {
    getPresignedUrl
      .mockResolvedValueOnce({ url: 'https://blob.example.com/expired', expiresAt: Date.now() - 1 })
      .mockResolvedValueOnce({ url: 'https://blob.example.com/ok2', expiresAt: Date.now() + 60000 })

    const fetchMock = jest.spyOn(global, 'fetch' as any)
      // First call returns 403
      .mockResolvedValueOnce(new Response('expired', { status: 403 }))
      // Second call returns OK
      .mockResolvedValueOnce(new Response('PDF-OK', { status: 200 }))

    const res = await GET(makeReq(`http://localhost/api/${org}/admin/cv/download?candidateId=${candidateId}`), { params: { org } })
    expect(res.status).toBe(200)
    const body = await res.text()
    expect(body).toBe('PDF-OK')

    // Ensure two presign attempts and two fetch calls happened
    expect(getPresignedUrl).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    fetchMock.mockRestore()
  })
})
