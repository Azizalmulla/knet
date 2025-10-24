import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/jobs/public - List all open jobs from all organizations
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgSlug = searchParams.get('org');
    const location = searchParams.get('location');
    const jobType = searchParams.get('job_type');
    const workMode = searchParams.get('work_mode');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    let query = `
      SELECT 
        j.id::text,
        j.title,
        j.department,
        j.location,
        j.job_type,
        j.work_mode,
        j.salary_min,
        j.salary_max,
        j.salary_currency,
        j.description,
        j.requirements,
        j.responsibilities,
        j.benefits,
        j.skills,
        j.slug,
        j.view_count,
        j.application_count,
        j.created_at,
        o.name as company_name,
        o.slug as company_slug,
        o.logo_url as company_logo
      FROM jobs j
      JOIN organizations o ON o.id = j.org_id
      WHERE j.status = 'open'
    `;
    
    const params: any[] = [];
    let paramIndex = 1;
    
    // Filter by organization
    if (orgSlug) {
      query += ` AND o.slug = $${paramIndex}`;
      params.push(orgSlug);
      paramIndex++;
    }
    
    // Filter by location
    if (location) {
      query += ` AND j.location ILIKE $${paramIndex}`;
      params.push(`%${location}%`);
      paramIndex++;
    }
    
    // Filter by job type
    if (jobType) {
      query += ` AND j.job_type = $${paramIndex}`;
      params.push(jobType);
      paramIndex++;
    }
    
    // Filter by work mode
    if (workMode) {
      query += ` AND j.work_mode = $${paramIndex}`;
      params.push(workMode);
      paramIndex++;
    }
    
    // Search in title, description, requirements
    if (search) {
      query += ` AND (
        j.title ILIKE $${paramIndex} OR
        j.description ILIKE $${paramIndex} OR
        j.requirements ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    query += ` ORDER BY j.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    
    const result = await sql.query(query, params);
    
    // Get total count with same filters
    let countQuery = `
      SELECT COUNT(*) as total
      FROM jobs j
      JOIN organizations o ON o.id = j.org_id
      WHERE j.status = 'open'
    `;
    
    const countParams: any[] = [];
    let countParamIndex = 1;
    
    if (orgSlug) {
      countQuery += ` AND o.slug = $${countParamIndex}`;
      countParams.push(orgSlug);
      countParamIndex++;
    }
    if (location) {
      countQuery += ` AND j.location ILIKE $${countParamIndex}`;
      countParams.push(`%${location}%`);
      countParamIndex++;
    }
    if (jobType) {
      countQuery += ` AND j.job_type = $${countParamIndex}`;
      countParams.push(jobType);
      countParamIndex++;
    }
    if (workMode) {
      countQuery += ` AND j.work_mode = $${countParamIndex}`;
      countParams.push(workMode);
      countParamIndex++;
    }
    if (search) {
      countQuery += ` AND (
        j.title ILIKE $${countParamIndex} OR
        j.description ILIKE $${countParamIndex} OR
        j.requirements ILIKE $${countParamIndex}
      )`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }
    
    const countResult = await sql.query(countQuery, countParams);
    
    return NextResponse.json({
      jobs: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit,
      offset
    });
    
  } catch (error: any) {
    console.error('[JOBS_PUBLIC_GET] Error:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}
