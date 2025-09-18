import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { z } from 'zod';

// Schema for role template
const RoleTemplateSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  mustHaveSkills: z.array(z.string()).default([]),
  niceToHaveSkills: z.array(z.string()).default([]),
  minYears: z.number().default(0),
  language: z.string().optional(),
  location: z.string().optional(),
  department: z.string().optional(),
});

// Verify admin auth
function verifyAdmin(request: NextRequest): boolean {
  const provided = (request.headers.get('x-admin-key') || '').trim();
  const envKey = (process.env.ADMIN_KEY || '').trim();
  const fallback = process.env.NODE_ENV !== 'production' ? 'test-admin-key' : '';
  if (!provided) return false;
  return [envKey, fallback].filter(Boolean).includes(provided);
}

// GET: List all templates
export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const { rows: templates } = await sql`
      SELECT 
        id,
        name,
        title,
        must_have_skills as "mustHaveSkills",
        nice_to_have_skills as "niceToHaveSkills",
        min_years as "minYears",
        language,
        location,
        department,
        created_at as "createdAt"
      FROM role_templates
      ORDER BY created_at DESC
    `;
    
    return NextResponse.json({ templates });
  } catch (error: any) {
    console.error('Failed to fetch templates:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

// POST: Create new template
export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const validated = RoleTemplateSchema.parse(body);
    
    const userEmail = request.headers.get('x-user-email') || 'admin';
    
    const { rows } = await sql`
      INSERT INTO role_templates (
        name,
        title,
        must_have_skills,
        nice_to_have_skills,
        min_years,
        language,
        location,
        department,
        created_by
      ) VALUES (
        ${validated.name},
        ${validated.title},
        ${JSON.stringify(validated.mustHaveSkills)},
        ${JSON.stringify(validated.niceToHaveSkills)},
        ${validated.minYears},
        ${validated.language || null},
        ${validated.location || null},
        ${validated.department || null},
        ${userEmail}
      )
      RETURNING id, name
    `;
    
    return NextResponse.json({ 
      success: true, 
      template: rows[0],
      message: 'Template saved successfully' 
    });
  } catch (error: any) {
    console.error('Failed to create template:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}

// DELETE: Remove template
export async function DELETE(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Template ID required' }, { status: 400 });
    }
    
    await sql`DELETE FROM role_templates WHERE id = ${id}`;
    
    return NextResponse.json({ success: true, message: 'Template deleted' });
  } catch (error: any) {
    console.error('Failed to delete template:', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
