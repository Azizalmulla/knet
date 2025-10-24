import { NextRequest } from 'next/server'
import { GET as ExportGET } from '@/app/api/[org]/admin/candidates/export/route'

function buildUrlFromBody(req: NextRequest, body: any) {
  const url = new URL(req.url)
  const sp = url.searchParams
  const filters = ['degree','yoe','area','cvType','parseStatus','from','to','limit']
  for (const k of filters) {
    const v = (body?.[k] ?? '').toString().trim()
    if (v) sp.set(k, v)
  }
  return new Request(url.toString(), { headers: req.headers }) as any
}

export async function POST(request: NextRequest, ctx: { params: { org: string } }) {
  try {
    const body = await request.json().catch(() => ({}))
    const fwdReq = buildUrlFromBody(request, body)
    return await ExportGET(fwdReq as any, ctx as any)
  } catch {
    return await ExportGET(request as any, ctx as any)
  }
}

// Optional: also support GET on this path to match older integrations
export async function GET(request: NextRequest, ctx: { params: { org: string } }) {
  return await ExportGET(request as any, ctx as any)
}
