import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, createRateLimitResponse } from '@/lib/rateLimit';
import { getDbClient } from '@/lib/db-client';
import { safeError } from '@/lib/redact';

interface FieldAreaCombo {
  field_of_study: string;
  area_of_interest: string;
  count: number;
  percentage: number;
}

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = checkRateLimit(request);
    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult);
    }

    const { searchParams } = new URL(request.url);
    const rawLimit = searchParams.get('limit');
    let parsed = parseInt(rawLimit ?? '10');
    if (Number.isNaN(parsed)) parsed = 10;
    const limit = Math.min(parsed, 50); // Max 50 results
    
    const db = getDbClient();
    
    // Get top field/area combinations with counts
    const query = `
      SELECT 
        field_of_study,
        area_of_interest,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
      FROM students 
      WHERE field_of_study IS NOT NULL 
        AND area_of_interest IS NOT NULL
        AND field_of_study != ''
        AND area_of_interest != ''
      GROUP BY field_of_study, area_of_interest
      ORDER BY count DESC
      LIMIT $1
    `;
    
    const result = await db.query(query, [limit]);
    
    const combos: FieldAreaCombo[] = result.rows.map((row: any) => ({
      field_of_study: row.field_of_study,
      area_of_interest: row.area_of_interest,
      count: parseInt(row.count),
      percentage: parseFloat(row.percentage)
    }));

    // Get total submissions for context
    const totalResult = await db.query(
      'SELECT COUNT(*) as total FROM students WHERE field_of_study IS NOT NULL AND area_of_interest IS NOT NULL'
    );
    const totalSubmissions = parseInt(totalResult.rows[0]?.total || 0);

    return NextResponse.json({
      success: true,
      data: {
        combos,
        totalSubmissions,
        limit,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    safeError('TELEMETRY_API_ERROR', error, {
      url: request.url,
      method: request.method
    });
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch telemetry data',
        success: false 
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
