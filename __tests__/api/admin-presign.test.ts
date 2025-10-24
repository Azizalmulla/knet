import { POST } from '@/app/api/[org]/admin/cv/presign/route'

// Mocks
// Ensure rows is typed as any[] to avoid never[] inference in TS
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

jest.mock('@/lib/storage', () => ({
  getPresignedUrl: jest.fn(async (key: string, ttl: number) => ({ url: `https://presigned.test/${key}?ttl=${ttl}`, expiresAt: Date.now() + ttl * 1000 }))
}))

function makeReq(org: string, body: any): any {
  return {
    url: `http://localhost/api/${org}/admin/cv/presign`,
    json: () => Promise.resolve(body),
    headers: new Map([['x-forwarded-for', '127.0.0.1']])
  } as any
}

describe('POST /api/[org]/admin/cv/presign', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('returns 400 if candidateId missing', async () => {
    const res = await POST(makeReq('knet', {}), { params: { org: 'knet' } })
    expect(res.status).toBe(400)
  })

  test('404 for wrong org or missing candidate', async () => {
    mockSqlTag.mockResolvedValueOnce({ rows: [] })
    const res = await POST(makeReq('knet', { candidateId: 'uuid-x' }), { params: { org: 'knet' } })
    expect(res.status).toBe(404)
  })

  test('presigns and returns URL when candidate exists and key present, logs cv_presign', async () => {
    // Mock the SQL template literal call for the SELECT query
    mockSqlTag.mockResolvedValueOnce({ rows: [{ id: 'uuid-1', cv_blob_key: 'objs/key1.pdf', slug: 'knet', org_id: 'org-uuid' }] })
    
    const req = makeReq('knet', { candidateId: 'uuid-1' })
    // add admin headers for metadata
    ;(req as any).headers.set('x-admin-email', 'admin@knet.com')
    const res = await POST(req, { params: { org: 'knet' } })
    const data = await (res as any).json()
    expect(res.status).toBe(200)
    expect(typeof data.url).toBe('string')

    // Assert audit insert called with action 'cv_presign'
    const insertCall: any[] | undefined = (mockSqlTag.mock.calls as any[]).find((a: any[]) => String(a?.[0] || '').includes('INSERT INTO admin_activity'))
    expect(String((insertCall && insertCall[0]) || '')).toContain('cv_presign')
  })
})
