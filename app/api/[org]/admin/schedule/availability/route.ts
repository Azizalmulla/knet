import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { jwtVerify } from '@/lib/esm-compat/jose';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/[org]/admin/schedule/availability
 * 
 * Get admin's availability slots
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { org: string } }
) {
  try {
    const orgSlug = params.org;

    // Verify JWT
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret-key';
    let decoded: any;
    
    try {
      const result = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
      decoded = result.payload;
    } catch (jwtError) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (decoded.org !== orgSlug) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const adminId = decoded.sub;
    const orgId = decoded.orgId;

    // Get query params
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const includeBooked = searchParams.get('include_booked') === 'true';

    // Build query
    let query = `
      SELECT 
        a.id,
        a.start_time,
        a.end_time,
        a.duration_minutes,
        a.is_booked,
        a.meeting_link,
        a.notes,
        a.created_at,
        b.candidate_name,
        b.candidate_email,
        b.status as booking_status
      FROM interview_availability a
      LEFT JOIN interview_bookings b ON a.booking_id = b.id
      WHERE a.organization_id = $1
      AND a.admin_id = $2
    `;

    const queryParams: any[] = [orgId, adminId];
    let paramCount = 2;

    if (startDate) {
      paramCount++;
      query += ` AND a.start_time >= $${paramCount}`;
      queryParams.push(startDate);
    }

    if (endDate) {
      paramCount++;
      query += ` AND a.end_time <= $${paramCount}`;
      queryParams.push(endDate);
    }

    if (!includeBooked) {
      query += ` AND a.is_booked = false`;
    }

    query += ` ORDER BY a.start_time ASC`;

    const result = await sql.query(query, queryParams);

    return NextResponse.json({
      success: true,
      slots: result.rows,
    });

  } catch (error: any) {
    console.error('[Schedule API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch availability', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/[org]/admin/schedule/availability
 * 
 * Create new availability slots
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { org: string } }
) {
  try {
    const orgSlug = params.org;

    // Verify JWT
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret-key';
    let decoded: any;
    
    try {
      const result = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
      decoded = result.payload;
    } catch (jwtError) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (decoded.org !== orgSlug) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const adminId = decoded.sub;
    const orgId = decoded.orgId;

    const body = await request.json();
    const { slots } = body; // Array of { start_time, end_time, duration_minutes, meeting_link?, notes? }

    if (!Array.isArray(slots) || slots.length === 0) {
      return NextResponse.json({ error: 'Invalid slots data' }, { status: 400 });
    }

    // Insert slots
    const insertedSlots = [];
    for (const slot of slots) {
      const result = await sql`
        INSERT INTO interview_availability (
          organization_id, admin_id, start_time, end_time, 
          duration_minutes, meeting_link, notes
        )
        VALUES (
          ${orgId}::uuid, ${adminId}::uuid, ${slot.start_time}, ${slot.end_time},
          ${slot.duration_minutes || 30}, ${slot.meeting_link || null}, ${slot.notes || null}
        )
        RETURNING *
      `;
      insertedSlots.push(result.rows[0]);
    }

    return NextResponse.json({
      success: true,
      message: `Created ${insertedSlots.length} availability slots`,
      slots: insertedSlots,
    });

  } catch (error: any) {
    console.error('[Schedule API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create availability', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/[org]/admin/schedule/availability
 * 
 * Delete availability slot (only if not booked)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { org: string } }
) {
  try {
    const orgSlug = params.org;

    // Verify JWT
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret-key';
    let decoded: any;
    
    try {
      const result = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
      decoded = result.payload;
    } catch (jwtError) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (decoded.org !== orgSlug) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const adminId = decoded.sub;

    const { searchParams } = new URL(request.url);
    const slotId = searchParams.get('slot_id');

    if (!slotId) {
      return NextResponse.json({ error: 'Missing slot_id' }, { status: 400 });
    }

    // Check if slot is booked
    const checkResult = await sql`
      SELECT is_booked FROM interview_availability
      WHERE id = ${slotId}::uuid AND admin_id = ${adminId}::uuid
    `;

    if (checkResult.rows.length === 0) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
    }

    if (checkResult.rows[0].is_booked) {
      return NextResponse.json({ error: 'Cannot delete booked slot' }, { status: 400 });
    }

    // Delete slot
    await sql`
      DELETE FROM interview_availability
      WHERE id = ${slotId}::uuid AND admin_id = ${adminId}::uuid
    `;

    return NextResponse.json({
      success: true,
      message: 'Availability slot deleted',
    });

  } catch (error: any) {
    console.error('[Schedule API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete availability', details: error.message },
      { status: 500 }
    );
  }
}
