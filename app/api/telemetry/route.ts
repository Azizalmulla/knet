import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Ensure tables exist
    await sql`
      CREATE TABLE IF NOT EXISTS telemetry_selections (
        id SERIAL PRIMARY KEY,
        field_of_study TEXT NOT NULL,
        area_of_interest TEXT NOT NULL,
        action TEXT NOT NULL,
        timestamp TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS telemetry_events (
        id SERIAL PRIMARY KEY,
        event TEXT NOT NULL,
        value INTEGER,
        meta JSONB,
        timestamp TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Batch mode: { events: [{ event, value?, meta? } | { field, area, action }] }
    if (Array.isArray(body?.events)) {
      for (const ev of body.events) {
        if (ev && typeof ev === 'object') {
          if (ev.field && ev.area && ev.action) {
            await sql`
              INSERT INTO telemetry_selections (field_of_study, area_of_interest, action)
              VALUES (${ev.field}, ${ev.area}, ${ev.action})
            `;
          } else if (ev.event) {
            await sql`
              INSERT INTO telemetry_events (event, value, meta)
              VALUES (${ev.event}, ${ev.value ?? null}, ${ev.meta ? JSON.stringify(ev.meta) : null})
            `;
          }
        }
      }
      return NextResponse.json({ success: true });
    }

    // Single selection fallback: { field, area, action }
    const { field, area, action } = body || {};
    if (field && area && action) {
      await sql`
        INSERT INTO telemetry_selections (field_of_study, area_of_interest, action)
        VALUES (${field}, ${area}, ${action})
      `;
      return NextResponse.json({ success: true });
    }

    // Generic single event fallback: { event, value?, meta? }
    if (body?.event) {
      await sql`
        INSERT INTO telemetry_events (event, value, meta)
        VALUES (${body.event}, ${body.value ?? null}, ${body.meta ? JSON.stringify(body.meta) : null})
      `;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid telemetry payload' }, { status: 400 });
  } catch (error) {
    console.error('Telemetry error:', error);
    return NextResponse.json({ error: 'Failed to log telemetry' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const summary = searchParams.get('summary');

    if (summary === 'today') {
      // Return simple event counts for the current day
      await sql`
        CREATE TABLE IF NOT EXISTS telemetry_events (
          id SERIAL PRIMARY KEY,
          event TEXT NOT NULL,
          value INTEGER,
          meta JSONB,
          timestamp TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      const today = await sql`
        SELECT event, COUNT(*)::int AS count
        FROM telemetry_events
        WHERE timestamp::date = CURRENT_DATE
        GROUP BY event
        ORDER BY count DESC
      `;
      return NextResponse.json(today.rows);
    }

    // Default: popular selections (existing behavior)
    const result = await sql`
      SELECT 
        field_of_study,
        area_of_interest,
        COUNT(*) as selection_count
      FROM telemetry_selections 
      WHERE action = 'selection'
      GROUP BY field_of_study, area_of_interest
      ORDER BY selection_count DESC
      LIMIT 20
    `;

    return NextResponse.json({ 
      popularSelections: result.rows 
    });
  } catch (error) {
    console.error('Telemetry fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch telemetry' }, { status: 500 });
  }
}
