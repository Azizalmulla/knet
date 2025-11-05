import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { jwtVerify } from '@/lib/esm-compat/jose'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET: List all templates for org
export async function GET(
  req: NextRequest,
  { params }: { params: { org: string } }
) {
  try {
    const token = req.cookies.get('admin_session')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production'
    )
    
    let decoded: any
    try {
      const { payload } = await jwtVerify(token, secret)
      decoded = payload
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (decoded.orgSlug !== params.org) {
      return NextResponse.json({ error: 'Unauthorized for this organization' }, { status: 403 })
    }

    const orgResult = await sql`
      SELECT id FROM organizations WHERE slug = ${params.org}
    `
    
    if (!orgResult.rows.length) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    const orgId = orgResult.rows[0].id

    const result = await sql`
      SELECT 
        t.id,
        t.title,
        t.description,
        t.status,
        t.created_at,
        t.updated_at,
        (SELECT COUNT(*) FROM interview_questions WHERE template_id = t.id) as question_count,
        (SELECT COUNT(*) FROM interview_sessions WHERE template_id = t.id) as session_count
      FROM interview_templates t
      WHERE t.org_id = ${orgId}
      ORDER BY t.created_at DESC
    `

    return NextResponse.json({
      success: true,
      templates: result.rows
    })
  } catch (error) {
    console.error('[INTERVIEW_TEMPLATES_LIST] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }
}

// POST: Create new template
export async function POST(
  req: NextRequest,
  { params }: { params: { org: string } }
) {
  try {
    const token = req.cookies.get('admin_session')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production'
    )
    
    let decoded: any
    try {
      const { payload } = await jwtVerify(token, secret)
      decoded = payload
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (decoded.orgSlug !== params.org) {
      return NextResponse.json({ error: 'Unauthorized for this organization' }, { status: 403 })
    }

    const orgResult = await sql`
      SELECT id FROM organizations WHERE slug = ${params.org}
    `
    
    if (!orgResult.rows.length) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    const orgId = orgResult.rows[0].id
    const body = await req.json()

    const { title, description, questions } = body

    if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: 'Title and questions are required' }, { status: 400 })
    }

    // Create template
    const templateResult = await sql`
      INSERT INTO interview_templates (org_id, title, description, status, created_by)
      VALUES (${orgId}, ${title}, ${description || ''}, 'active', ${decoded.email || null})
      RETURNING id
    `

    const templateId = templateResult.rows[0].id

    // Create questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      await sql`
        INSERT INTO interview_questions (
          template_id, 
          question_text, 
          question_type, 
          time_limit_seconds, 
          order_index
        )
        VALUES (
          ${templateId},
          ${q.question_text || q.text},
          ${q.question_type || 'video'},
          ${q.time_limit_seconds || 120},
          ${i + 1}
        )
      `
    }

    return NextResponse.json({
      success: true,
      template: {
        id: templateId,
        title,
        description,
        question_count: questions.length
      }
    })
  } catch (error) {
    console.error('[INTERVIEW_TEMPLATES_CREATE] Error:', error)
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
}
