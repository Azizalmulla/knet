/**
 * Inbox API - List threads for an organization
 * GET /api/[org]/admin/inbox
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET(
  req: NextRequest,
  { params }: { params: { org: string } }
) {
  const orgSlug = params.org;

  try {
    // Get organization
    const orgResult = await sql`
      SELECT id, name FROM organizations WHERE slug = ${orgSlug}
    `;

    const org = orgResult.rows[0];
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get query params
    const searchParams = req.nextUrl.searchParams;
    const filter = searchParams.get('filter') || 'all'; // all | unread
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Fetch threads with filters
    const threads = filter === 'unread'
      ? await sql`
          SELECT 
            t.id,
            t.subject,
            t.candidate_name,
            t.candidate_email,
            t.candidate_id,
            t.is_archived,
            t.unread_count,
            t.last_message_at,
            t.created_at,
            (
              SELECT content 
              FROM inbox_messages 
              WHERE thread_id = t.id 
              ORDER BY created_at DESC 
              LIMIT 1
            ) as last_message_preview
          FROM inbox_threads t
          WHERE t.organization_id = ${org.id}
            AND t.unread_count > 0
            AND (
              t.candidate_name ILIKE ${'%' + search + '%'} OR
              t.candidate_email ILIKE ${'%' + search + '%'} OR
              t.subject ILIKE ${'%' + search + '%'} OR
              ${!search}
            )
          ORDER BY t.last_message_at DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `
      : await sql`
          SELECT 
            t.id,
            t.subject,
            t.candidate_name,
            t.candidate_email,
            t.candidate_id,
            t.is_archived,
            t.unread_count,
            t.last_message_at,
            t.created_at,
            (
              SELECT content 
              FROM inbox_messages 
              WHERE thread_id = t.id 
              ORDER BY created_at DESC 
              LIMIT 1
            ) as last_message_preview
          FROM inbox_threads t
          WHERE t.organization_id = ${org.id}
            AND (
              t.candidate_name ILIKE ${'%' + search + '%'} OR
              t.candidate_email ILIKE ${'%' + search + '%'} OR
              t.subject ILIKE ${'%' + search + '%'} OR
              ${!search}
            )
          ORDER BY t.last_message_at DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `;

    // Get total count
    const countResult = filter === 'unread'
      ? await sql`
          SELECT COUNT(*)::int as count
          FROM inbox_threads t
          WHERE t.organization_id = ${org.id}
            AND t.unread_count > 0
            AND (
              t.candidate_name ILIKE ${'%' + search + '%'} OR
              t.candidate_email ILIKE ${'%' + search + '%'} OR
              t.subject ILIKE ${'%' + search + '%'} OR
              ${!search}
            )
        `
      : await sql`
          SELECT COUNT(*)::int as count
          FROM inbox_threads t
          WHERE t.organization_id = ${org.id}
            AND (
              t.candidate_name ILIKE ${'%' + search + '%'} OR
              t.candidate_email ILIKE ${'%' + search + '%'} OR
              t.subject ILIKE ${'%' + search + '%'} OR
              ${!search}
            )
        `;
    const count = countResult.rows[0]?.count || 0;

    return NextResponse.json({
      threads: threads.rows,
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Failed to fetch inbox:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inbox' },
      { status: 500 }
    );
  }
}
