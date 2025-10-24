import { GET } from '@/app/api/[org]/admin/candidates/export/route'

// Mock @vercel/postgres
const mockSqlTag = jest.fn(async () => ({ rows: [] }))
const mockQuery = jest.fn()

jest.mock('@vercel/postgres', () => {
  const tag: any = function(strings: TemplateStringsArray) {
    const args: any[] = Array.prototype.slice.call(arguments)
    // first arg is strings array; rest are values
    return (mockSqlTag as any).apply(null, args)
  }
  tag.query = function() {
    const args: any[] = Array.prototype.slice.call(arguments)
    return (mockQuery as any).apply(null, args)
  }
  return { sql: tag }
})

function makeReq(url: string, headers: Record<string,string> = {}): any {
  return {
    url,
    headers: new Map(Object.entries(headers))
  } as any
}

describe('GET /api/[org]/admin/candidates/export', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('org isolation and filters are applied; returns CSV content-disposition', async () => {
    // arrange mock rows
    mockQuery
      // first select chunk
      .mockResolvedValueOnce({ rows: [
        { candidate_id: 'uuid-1', name: 'A', email: 'a@x.com', phone: '', submitted_at: new Date().toISOString(), parse_status: 'done', cv_file_key: 'k1.pdf' }
      ] })
      // second select chunk (no more rows)
      .mockResolvedValueOnce({ rows: [] })

    const res = await GET(
      makeReq('http://localhost/api/knet/admin/candidates/export?degree=Bachelor&yoe=Junior&cvType=uploaded&from=2025-01-01', { 'x-admin-email': 'admin@knet.com' }),
      { params: { org: 'knet' } }
    )

    expect(res.status).toBe(200)
    const disp = res.headers.get('content-disposition') || ''
    expect(disp).toContain('candidates_knet_')
  })
})
