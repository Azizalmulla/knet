import { GET } from '@/app/api/[org]/admin/audit/route'

const mockSqlTag = jest.fn()
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

function makeReq(url: string): any {
  return { url, headers: new Map() } as any
}

describe('GET /api/[org]/admin/audit', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('applies filters and pagination; returns events and total', async () => {
    // org resolution
    mockSqlTag.mockResolvedValueOnce({ rows: [{ id: 'org-uuid' }] })
    // select rows
    mockQuery
      .mockResolvedValueOnce({ rows: [
        { created_at: new Date().toISOString(), action: 'cv_presign', candidate_id: 'uuid-1', admin_email: 'a@x.com', ip: '1.2.3.4', user_agent: 'UA', metadata: { foo: 'bar' }, candidate_name: 'Alice' }
      ] })
      // count
      .mockResolvedValueOnce({ rows: [{ cnt: 1 }] })

    const from = new Date(Date.now() - 7*24*60*60*1000).toISOString()
    const res = await GET(
      makeReq(`http://localhost/api/knet/admin/audit?action=cv_presign&admin_email=a@x.com&ip=1.2.3.4&user_agent=UA&from=${encodeURIComponent(from)}&limit=10&offset=0`),
      { params: { org: 'knet' } }
    )
    const data = await (res as any).json()
    expect(res.status).toBe(200)
    expect(Array.isArray(data.events)).toBe(true)
    expect(typeof data.total).toBe('number')

    const firstCall: any[] = (mockQuery.mock.calls as any[])[0]
    const q1 = firstCall[0]
    const params1 = firstCall[1]
    expect(String(q1)).toContain('FROM admin_activity a')
    expect(String(q1)).toContain('ORDER BY a.timestamp DESC')
    // ensure param 1 is org id and offset/limit are last two params
    expect(params1.at(-2)).toBe(0)
    expect(params1.at(-1)).toBe(10)
  })

  test('tenant isolation: wrong org returns empty', async () => {
    mockSqlTag.mockResolvedValueOnce({ rows: [] })
    const res = await GET(makeReq('http://localhost/api/nbk/admin/audit'), { params: { org: 'nbk' } })
    const data = await (res as any).json()
    expect(res.status).toBe(200)
    expect(Array.isArray(data.events)).toBe(true)
    expect(data.events.length).toBe(0)
  })
})
