import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { Resend } from 'resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/**
 * GET /api/[org]/schedule/book
 * 
 * Get available interview slots for booking (public - no auth required)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { org: string } }
) {
  try {
    const orgSlug = params.org;

    // Get organization
    const orgRes = await sql`
      SELECT id, name FROM organizations WHERE slug = ${orgSlug} LIMIT 1
    `;
    
    if (!orgRes.rows.length) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    
    const org = orgRes.rows[0];
    const orgId = org.id;

    // Get query params
    const { searchParams } = new URL(request.url);
    const adminEmail = searchParams.get('admin_email'); // Optional: filter by specific admin

    // Get available slots (not booked, in the future)
    let query = `
      SELECT 
        a.id,
        a.start_time,
        a.end_time,
        a.duration_minutes,
        a.meeting_link,
        u.email as admin_email,
        u.id as admin_id
      FROM interview_availability a
      JOIN admin_users u ON a.admin_id = u.id
      WHERE a.organization_id = $1
      AND a.is_booked = false
      AND a.start_time > NOW()
    `;

    const queryParams: any[] = [orgId];

    if (adminEmail) {
      query += ` AND u.email = $2`;
      queryParams.push(adminEmail);
    }

    query += ` ORDER BY a.start_time ASC LIMIT 50`;

    const result = await sql.query(query, queryParams);

    return NextResponse.json({
      success: true,
      organization: org.name,
      availableSlots: result.rows,
    });

  } catch (error: any) {
    console.error('[Book API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available slots', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/[org]/schedule/book
 * 
 * Book an interview slot (public - no auth required)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { org: string } }
) {
  try {
    const orgSlug = params.org;

    // Get organization
    const orgRes = await sql`
      SELECT id, name FROM organizations WHERE slug = ${orgSlug} LIMIT 1
    `;
    
    if (!orgRes.rows.length) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    
    const org = orgRes.rows[0];
    const orgId = org.id;

    const body = await request.json();
    const {
      availability_id,
      candidate_name,
      candidate_email,
      candidate_phone,
      position_applying_for,
      interview_type,
      notes,
    } = body;

    // Validate required fields
    if (!availability_id || !candidate_name || !candidate_email) {
      return NextResponse.json({ 
        error: 'Missing required fields: availability_id, candidate_name, candidate_email' 
      }, { status: 400 });
    }

    // Check if slot is still available
    const slotCheck = await sql`
      SELECT 
        a.*,
        u.email as admin_email,
        u.id as admin_id
      FROM interview_availability a
      JOIN admin_users u ON a.admin_id = u.id
      WHERE a.id = ${availability_id}::uuid
      AND a.organization_id = ${orgId}::uuid
      AND a.is_booked = false
      AND a.start_time > NOW()
      FOR UPDATE
    `;

    if (slotCheck.rows.length === 0) {
      return NextResponse.json({ 
        error: 'Slot is no longer available or has passed' 
      }, { status: 409 });
    }

    const slot = slotCheck.rows[0];

    // Generate meeting link if not present
    let meetingLink = slot.meeting_link;
    if (!meetingLink) {
      // Generate a simple meeting link (in production, integrate with Zoom/Google Meet API)
      meetingLink = `https://meet.google.com/${Math.random().toString(36).substring(7)}`;
    }

    // Try to find existing candidate
    const candidateRes = await sql`
      SELECT id FROM candidates
      WHERE email = ${candidate_email}
      AND organization_id = ${orgId}::uuid
      LIMIT 1
    `;

    const candidateId = candidateRes.rows[0]?.id || null;

    // Create booking
    const bookingResult = await sql`
      INSERT INTO interview_bookings (
        organization_id,
        availability_id,
        candidate_id,
        candidate_name,
        candidate_email,
        candidate_phone,
        position_applying_for,
        interview_type,
        meeting_link,
        notes,
        status
      )
      VALUES (
        ${orgId}::uuid,
        ${availability_id}::uuid,
        ${candidateId}::uuid,
        ${candidate_name},
        ${candidate_email},
        ${candidate_phone || null},
        ${position_applying_for || 'General Interview'},
        ${interview_type || 'general'},
        ${meetingLink},
        ${notes || null},
        'confirmed'
      )
      RETURNING *
    `;

    const booking = bookingResult.rows[0];

    // Send confirmation emails
    if (resend) {
      try {
        // Email to candidate
        await resend.emails.send({
          from: `${org.name} <noreply@wathefni.ai>`,
          to: candidate_email,
          subject: `Interview Confirmed - ${org.name}`,
          html: `
            <h2>Your Interview is Confirmed!</h2>
            <p>Hi ${candidate_name},</p>
            <p>Your interview with <strong>${org.name}</strong> has been scheduled.</p>
            <p><strong>Date & Time:</strong> ${new Date(slot.start_time).toLocaleString('en-US', { 
              dateStyle: 'full', 
              timeStyle: 'short',
              timeZone: 'Asia/Kuwait' 
            })}</p>
            <p><strong>Duration:</strong> ${slot.duration_minutes} minutes</p>
            <p><strong>Meeting Link:</strong> <a href="${meetingLink}">${meetingLink}</a></p>
            ${position_applying_for ? `<p><strong>Position:</strong> ${position_applying_for}</p>` : ''}
            <p>We'll send you a reminder 24 hours before your interview.</p>
            <p>Good luck!</p>
          `,
        });

        // Email to admin
        await resend.emails.send({
          from: `Wathefni Scheduling <noreply@wathefni.ai>`,
          to: slot.admin_email,
          subject: `New Interview Booked - ${candidate_name}`,
          html: `
            <h2>New Interview Booking</h2>
            <p><strong>Candidate:</strong> ${candidate_name} (${candidate_email})</p>
            ${candidate_phone ? `<p><strong>Phone:</strong> ${candidate_phone}</p>` : ''}
            <p><strong>Date & Time:</strong> ${new Date(slot.start_time).toLocaleString('en-US', { 
              dateStyle: 'full', 
              timeStyle: 'short',
              timeZone: 'Asia/Kuwait' 
            })}</p>
            <p><strong>Duration:</strong> ${slot.duration_minutes} minutes</p>
            ${position_applying_for ? `<p><strong>Position:</strong> ${position_applying_for}</p>` : ''}
            ${notes ? `<p><strong>Candidate Notes:</strong> ${notes}</p>` : ''}
            <p><strong>Meeting Link:</strong> <a href="${meetingLink}">${meetingLink}</a></p>
          `,
        });

      } catch (emailError) {
        console.error('[Book API] Email error:', emailError);
        // Continue even if email fails
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Interview booked successfully!',
      booking: {
        id: booking.id,
        start_time: slot.start_time,
        end_time: slot.end_time,
        duration_minutes: slot.duration_minutes,
        meeting_link: meetingLink,
        status: booking.status,
      },
    });

  } catch (error: any) {
    console.error('[Book API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to book interview', details: error.message },
      { status: 500 }
    );
  }
}
