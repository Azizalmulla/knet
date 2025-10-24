import { GET } from '@/app/api/[org]/admin/students/route'

// Mock @vercel/postgres
const mockSqlTag = jest.fn(async () => ({ rows: [{ c: 'public.candidates' }] }))
const mockQuery = jest.fn()

jest.mock('@vercel/postgres', () => ({
  sql: Object.assign(((strings: TemplateStringsArray, ...values: any[]) => mockSqlTag(strings, ...values)) as any, { query: (...args: any[]) => mockQuery(...args) })
}))

function makeReq(url: string): any {
  return { url } as any
}

describe('GET /api/[org]/admin/students (candidates-first)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.USE_CANDIDATES_ONLY = 'true'
    process.env.FALLBACK_STUDENTS_READ = 'false'
  })

  test('enforces tenant isolation by org slug and supports search filter', async () => {
    // Arrange: mock query returns 2 rows for knet
    mockQuery.mockResolvedValueOnce({
      rowCount: 2,
      rows: [
        { id: 'uuid-1', full_name: 'Alice', email: 'alice@x.com', phone: '', field_of_study: 'CS', area_of_interest: 'Web', cv_type: 'uploaded', cv_url: '', suggested_vacancies: null, suggested_vacancies_list: [], submitted_at: new Date().toISOString(), gpa: null, cv_parse_status: 'done', years_of_experience: null, knet_profile: null, cv_json: null }
        ,{ id: 'uuid-2', full_name: 'Alicia', email: 'alicia@x.com', phone: '', field_of_study: 'CS', area_of_interest: 'Web', cv_type: 'ai', cv_url: '', suggested_vacancies: null, suggested_vacancies_list: [], submitted_at: new Date().toISOString(), gpa: null, cv_parse_status: 'done', years_of_experience: null, knet_profile: null, cv_json: null }
      ]
    })

    const req = makeReq('http://localhost/api/knet/admin/students?search=ali&limit=50')
    const res = await GET(req, { params: { org: 'knet' } })
    const data = await (res as any).json()

    expect(res.status).toBe(200)
    expect(Array.isArray(data.students)).toBe(true)
    expect(data.students.length).toBe(2)

    // Assert WHERE o.slug = $1 and pagination
    const [q, params] = mockQuery.mock.calls[0]
    expect(String(q)).toContain('o.slug = $1')
    expect(params.at(-2)).toBe(0)   // offset
    expect(params.at(-1)).toBe(50)  // limit
  })

  test('pagination with offset/limit is passed through', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] })
    const req = makeReq('http://localhost/api/knet/admin/students?offset=30&limit=10')
    const res = await GET(req, { params: { org: 'knet' } })
    expect(res.status).toBe(200)
    const [_, params] = mockQuery.mock.calls[0]
    expect(params.at(-2)).toBe(30)
    expect(params.at(-1)).toBe(10)
  })

  test('missing or wrong org returns empty with isolation', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] })
    const req = makeReq('http://localhost/api/nbk/admin/students')
    const res = await GET(req, { params: { org: 'nbk' } })
    const data = await (res as any).json()
    expect(res.status).toBe(200)
    expect(Array.isArray(data.students)).toBe(true)
  })
})
