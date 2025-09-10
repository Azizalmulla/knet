import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import OpenAI from 'openai';

// Verify admin auth
function verifyAdmin(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const adminKey = process.env.ADMIN_KEY;
  
  if (!adminKey || !authHeader) return false;
  
  const token = authHeader.replace('Bearer ', '');
  return token === adminKey;
}

// Generate embeddings for a text
async function generateEmbedding(text: string): Promise<number[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }
  
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text,
  });
  
  return response.data[0].embedding;
}

// POST: Generate and store embeddings for all CVs
export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    // Get all CVs without embeddings
    const { rows: cvs } = await sql`
      SELECT 
        c.id,
        c.full_name,
        c.field_of_study,
        c.area_of_interest,
        c.suggested_vacancies,
        c.cv_data
      FROM cvs c
      LEFT JOIN cv_embeddings e ON c.id = e.student_id
      WHERE e.id IS NULL
      LIMIT 50
    `;
    
    let processed = 0;
    const errors = [];
    
    for (const cv of cvs) {
      try {
        // Parse CV data
        let cvData: any = {};
        try {
          cvData = typeof cv.cv_data === 'string' 
            ? JSON.parse(cv.cv_data) 
            : cv.cv_data || {};
        } catch {}
        
        // Create text representation for embedding
        const parsedText = [
          cv.full_name,
          cv.field_of_study,
          cv.area_of_interest,
          cv.suggested_vacancies,
          cvData.skills?.technical?.join(' '),
          cvData.skills?.soft?.join(' '),
          cvData.experience?.map((e: any) => 
            `${e.position} ${e.company} ${e.bullets?.join(' ')}`
          ).join(' '),
          cvData.projects?.map((p: any) => 
            `${p.name} ${p.description} ${p.technologies?.join(' ')}`
          ).join(' '),
          cvData.education?.map((e: any) => 
            `${e.degree} ${e.fieldOfStudy} ${e.institution}`
          ).join(' '),
        ].filter(Boolean).join(' ').slice(0, 8000); // Limit text length
        
        // Generate embedding
        const embedding = await generateEmbedding(parsedText);
        
        // Store embedding (convert to JSON for storage)
        await sql`
          INSERT INTO cv_embeddings (student_id, embedding, parsed_text)
          VALUES (${cv.id}, ${JSON.stringify(embedding)}, ${parsedText})
          ON CONFLICT (student_id)
          DO UPDATE SET 
            embedding = ${JSON.stringify(embedding)},
            parsed_text = ${parsedText},
            updated_at = NOW()
        `;
        
        processed++;
      } catch (error: any) {
        errors.push({ cvId: cv.id, error: error.message });
      }
    }
    
    return NextResponse.json({ 
      success: true,
      processed,
      total: cvs.length,
      errors,
      message: `Generated embeddings for ${processed}/${cvs.length} CVs`
    });
  } catch (error: any) {
    console.error('Failed to generate embeddings:', error);
    return NextResponse.json({ 
      error: 'Failed to generate embeddings',
      details: error.message 
    }, { status: 500 });
  }
}

// GET: Search CVs using semantic similarity
export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const limit = parseInt(searchParams.get('limit') || '10');
    
    if (!query) {
      return NextResponse.json({ error: 'Query required' }, { status: 400 });
    }
    
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    
    // Find similar CVs using cosine similarity
    // Note: This requires pgvector extension in PostgreSQL
    const { rows: results } = await sql`
      SELECT 
        c.id,
        c.full_name,
        c.email,
        c.field_of_study,
        c.area_of_interest,
        c.suggested_vacancies,
        e.parsed_text,
        1 - (e.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
      FROM cv_embeddings e
      JOIN cvs c ON e.student_id = c.id
      ORDER BY e.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
      LIMIT ${limit}
    `;
    
    return NextResponse.json({ 
      success: true,
      results,
      query
    });
  } catch (error: any) {
    console.error('Failed to search embeddings:', error);
    return NextResponse.json({ 
      error: 'Failed to search embeddings',
      details: error.message 
    }, { status: 500 });
  }
}
