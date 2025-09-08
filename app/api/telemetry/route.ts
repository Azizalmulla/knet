import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function POST(request: NextRequest) {
  try {
    const { field, area, action } = await request.json();

    // Create telemetry table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS telemetry_selections (
        id SERIAL PRIMARY KEY,
        field_of_study TEXT NOT NULL,
        area_of_interest TEXT NOT NULL,
        action TEXT NOT NULL,
        timestamp TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Insert telemetry data
    await sql`
      INSERT INTO telemetry_selections (field_of_study, area_of_interest, action)
      VALUES (${field}, ${area}, ${action})
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Telemetry error:', error);
    return NextResponse.json({ error: 'Failed to log telemetry' }, { status: 500 });
  }
}

export async function GET() {
  try {
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
