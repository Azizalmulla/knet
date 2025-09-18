import { NextRequest, NextResponse } from 'next/server';
import { adminFetch } from '@/lib/admin-fetch';
import { safeLog } from '@/lib/redact';
import { sql } from '@vercel/postgres';
import { del } from '@vercel/blob';

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication (trimmed x-admin-key)
    const provided = (request.headers.get('x-admin-key') || '').trim();
    const envKey = (process.env.ADMIN_KEY || '').trim();
    const fallback = process.env.NODE_ENV !== 'production' ? 'test-admin-key' : '';
    if (!provided || ![envKey, fallback].filter(Boolean).includes(provided)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

    switch (action) {
      case 'export': {
        // Export user data
        const result = await sql`
          SELECT id, full_name, email, phone, field_of_study, area_of_interest, 
                 suggested_vacancies_list, cv_url, created_at
          FROM students 
          WHERE email = ${email}
        `;

        safeLog('GDPR_EXPORT_REQUEST', {
          email: email.substring(0, 3) + '***',
          ip: clientIP,
          recordsFound: result.rows.length,
          timestamp: new Date().toISOString()
        });

        if (result.rows.length === 0) {
          return NextResponse.json({ 
            success: true, 
            message: 'No data found for this email',
            data: []
          });
        }

        return NextResponse.json({
          success: true,
          data: result.rows,
          exportedAt: new Date().toISOString()
        });
      }

      case 'delete': {
        // First, get CV URLs to delete from blob storage
        const cvResult = await sql`
          SELECT cv_url FROM students WHERE email = ${email}
        `;

        // Delete from database
        const deleteResult = await sql`
          DELETE FROM students WHERE email = ${email}
        `;

        // Delete CV files from blob storage
        let blobDeleteCount = 0;
        for (const row of cvResult.rows) {
          if (row.cv_url) {
            try {
              await del(row.cv_url);
              blobDeleteCount++;
            } catch (error) {
              console.error('Failed to delete blob:', row.cv_url, error);
            }
          }
        }

        safeLog('GDPR_DELETE_COMPLETE', {
          email: email.substring(0, 3) + '***',
          ip: clientIP,
          dbRecordsDeleted: deleteResult.rowCount,
          blobFilesDeleted: blobDeleteCount,
          timestamp: new Date().toISOString()
        });

        return NextResponse.json({
          success: true,
          message: `Deleted ${deleteResult.rowCount} database records and ${blobDeleteCount} files`,
          recordsDeleted: deleteResult.rowCount,
          filesDeleted: blobDeleteCount
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('GDPR API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
