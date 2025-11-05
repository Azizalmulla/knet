import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { jwtVerify } from '@/lib/esm-compat/jose'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET: Get template details with questions
export async function GET(
  req: NextRequest,
  { params }: { params: { org: string; templateId: string } }
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const orgResult = await sql`
      SELECT id FROM organizations WHERE slug = ${params.org}
    `
    
    if (!orgResult.rows.length) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    const orgId = orgResult.rows[0].id

    // Get template
    const templateResult = await sql`
      SELECT * FROM interview_templates
      WHERE id = ${params.templateId} AND org_id = ${orgId}
    `

    if (!templateResult.rows.length) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Get questions
    const questionsResult = await sql`
      SELECT * FROM interview_questions
      WHERE template_id = ${params.templateId}
      ORDER BY order_index ASC
    `

    return NextResponse.json({
      success: true,
      template: templateResult.rows[0],
      questions: questionsResult.rows
    })
  } catch (error) {
    console.error('[INTERVIEW_TEMPLATE_GET] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 })
  }
}

// DELETE: Delete template
export async function DELETE(
  req: NextRequest,
  { params }: { params: { org: string; templateId: string } }
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const orgResult = await sql`
      SELECT id FROM organizations WHERE slug = ${params.org}
    `
    
    if (!orgResult.rows.length) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    const orgId = orgResult.rows[0].id

    // Check if template has sessions
    const sessionsResult = await sql`
      SELECT COUNT(*) as count FROM interview_sessions
      WHERE template_id = ${params.templateId}
    `

    if (parseInt(sessionsResult.rows[0].count) > 0) {
      // Archive instead of delete
      await sql`
        UPDATE interview_templates
        SET status = 'archived'
        WHERE id = ${params.templateId} AND org_id = ${orgId}
      `
    } else {
      // Safe to delete
      await sql`
        DELETE FROM interview_templates
        WHERE id = ${params.templateId} AND org_id = ${orgId}
      `
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[INTERVIEW_TEMPLATE_DELETE] Error:', error)
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
  }
}
