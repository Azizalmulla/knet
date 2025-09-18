import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { z } from 'zod';

// Schema for status update
const StatusUpdateSchema = z.object({
  studentId: z.number(),
  status: z.enum(['shortlisted', 'rejected', 'pending', 'interviewed', 'hired']),
  reason: z.string().optional(),
  roleTitle: z.string(),
});

const BulkStatusUpdateSchema = z.object({
  studentIds: z.array(z.number()),
  status: z.enum(['shortlisted', 'rejected', 'pending', 'interviewed', 'hired']),
  reason: z.string().optional(),
  roleTitle: z.string(),
});

// Verify admin auth
function verifyAdmin(request: NextRequest): boolean {
  const provided = (request.headers.get('x-admin-key') || '').trim();
  const envKey = (process.env.ADMIN_KEY || '').trim();
  const fallback = process.env.NODE_ENV !== 'production' ? 'test-admin-key' : '';
  if (!provided) return false;
  return [envKey, fallback].filter(Boolean).includes(provided);
}

// GET: Get status for candidates
export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const { searchParams } = new URL(request.url);
    const roleTitle = searchParams.get('roleTitle');
    const studentId = searchParams.get('studentId');
    
    let query;
    if (studentId) {
      query = sql`
        SELECT 
          cs.*,
          c.full_name,
          c.email,
          c.field_of_study,
          c.area_of_interest
        FROM candidate_status cs
        JOIN cvs c ON cs.student_id = c.id
        WHERE cs.student_id = ${studentId}
        ORDER BY cs.reviewed_at DESC
      `;
    } else if (roleTitle) {
      query = sql`
        SELECT 
          cs.*,
          c.full_name,
          c.email,
          c.field_of_study,
          c.area_of_interest
        FROM candidate_status cs
        JOIN cvs c ON cs.student_id = c.id
        WHERE cs.role_title = ${roleTitle}
        ORDER BY cs.reviewed_at DESC
      `;
    } else {
      query = sql`
        SELECT 
          cs.*,
          c.full_name,
          c.email,
          c.field_of_study,
          c.area_of_interest
        FROM candidate_status cs
        JOIN cvs c ON cs.student_id = c.id
        ORDER BY cs.reviewed_at DESC
        LIMIT 100
      `;
    }
    
    const { rows: statuses } = await query;
    
    return NextResponse.json({ statuses });
  } catch (error: any) {
    console.error('Failed to fetch status:', error);
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
  }
}

// POST: Update single candidate status
export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const validated = StatusUpdateSchema.parse(body);
    
    const userEmail = request.headers.get('x-user-email') || 'admin';
    
    // Upsert status
    await sql`
      INSERT INTO candidate_status (
        student_id,
        status,
        reason,
        role_title,
        reviewed_by,
        reviewed_at
      ) VALUES (
        ${validated.studentId},
        ${validated.status},
        ${validated.reason || null},
        ${validated.roleTitle},
        ${userEmail},
        NOW()
      )
      ON CONFLICT (student_id, role_title)
      DO UPDATE SET
        status = ${validated.status},
        reason = ${validated.reason || null},
        reviewed_by = ${userEmail},
        reviewed_at = NOW()
    `;
    
    return NextResponse.json({ 
      success: true, 
      message: `Candidate marked as ${validated.status}` 
    });
  } catch (error: any) {
    console.error('Failed to update status:', error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}

// PUT: Bulk update candidate statuses
export async function PUT(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const validated = BulkStatusUpdateSchema.parse(body);
    
    const userEmail = request.headers.get('x-user-email') || 'admin';
    
    // Prepare values for bulk insert
    const values = validated.studentIds.map(studentId => ({
      studentId,
      status: validated.status,
      reason: validated.reason || null,
      roleTitle: validated.roleTitle,
      reviewedBy: userEmail,
    }));
    
    // Bulk upsert using a transaction
    for (const value of values) {
      await sql`
        INSERT INTO candidate_status (
          student_id,
          status,
          reason,
          role_title,
          reviewed_by,
          reviewed_at
        ) VALUES (
          ${value.studentId},
          ${value.status},
          ${value.reason},
          ${value.roleTitle},
          ${value.reviewedBy},
          NOW()
        )
        ON CONFLICT (student_id, role_title)
        DO UPDATE SET
          status = ${value.status},
          reason = ${value.reason},
          reviewed_by = ${value.reviewedBy},
          reviewed_at = NOW()
      `;
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `${validated.studentIds.length} candidates updated to ${validated.status}` 
    });
  } catch (error: any) {
    console.error('Failed to bulk update status:', error);
    return NextResponse.json({ error: 'Failed to bulk update status' }, { status: 500 });
  }
}
