import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { jwtVerify } from '@/lib/esm-compat/jose'
import { put } from '@vercel/blob'
import { parseCV } from '@/lib/cv-parser-gpt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for batch processing

/**
 * Bulk CV Import - Process single CV file
 * Called multiple times from frontend for parallel processing
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { org: string } }
) {
  try {
    // Auth check
    const token = request.cookies.get('admin_session')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'fallback'
    )

    let adminEmail = ''
    try {
      const { payload } = await jwtVerify(token, secret)
      adminEmail = (payload as any).email || ''
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const orgSlug = params.org

    // Get organization
    const orgResult = await sql`
      SELECT id, name FROM organizations WHERE slug = ${orgSlug} LIMIT 1
    `

    if (orgResult.rows.length === 0) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const orgId = orgResult.rows[0].id
    const orgName = orgResult.rows[0].name

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const batchId = formData.get('batchId') as string
    const fileIndex = parseInt(formData.get('fileIndex') as string || '0')

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const fileName = file.name
    const fileSize = file.size
    console.log(`[BULK_CV] Processing file ${fileIndex}: ${fileName} (${fileSize} bytes)`)

    // Validate file type
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    const isPDF = file.type === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')
    const isDOCX = file.type.includes('wordprocessingml') || fileName.toLowerCase().endsWith('.docx')

    if (!isPDF && !isDOCX) {
      return NextResponse.json({ 
        error: 'Invalid file type',
        fileName,
        message: 'Only PDF and DOCX files are supported'
      }, { status: 400 })
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer())
    const contentType = isPDF ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

    // Parse CV with GPT-4o Vision
    let parsedCV
    try {
      parsedCV = await parseCV(buffer, contentType)
      console.log(`[BULK_CV] Parsed: ${parsedCV.fullName} <${parsedCV.email}>`)
    } catch (parseError: any) {
      console.error(`[BULK_CV] Parse failed for ${fileName}:`, parseError.message)
      return NextResponse.json({
        error: 'Parse failed',
        fileName,
        message: parseError.message
      }, { status: 422 })
    }

    // Check for duplicate by email
    if (parsedCV.email) {
      const existingResult = await sql`
        SELECT id, full_name FROM candidates 
        WHERE org_id = ${orgId}::uuid 
          AND email = ${parsedCV.email.toLowerCase()}
          AND deleted_at IS NULL
        LIMIT 1
      `

      if (existingResult.rows.length > 0) {
        console.log(`[BULK_CV] Duplicate found: ${parsedCV.email}`)
        return NextResponse.json({
          duplicate: true,
          fileName,
          email: parsedCV.email,
          existingName: existingResult.rows[0].full_name,
          message: `Candidate with email ${parsedCV.email} already exists`
        }, { status: 200 })
      }
    }

    // Upload CV to blob storage
    const blobKey = `cv/${orgSlug}/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    let blobUrl = ''
    try {
      const blob = await put(blobKey, buffer, {
        access: 'public',
        contentType
      })
      blobUrl = blob.url
      console.log(`[BULK_CV] Uploaded to blob: ${blobUrl}`)
    } catch (blobError: any) {
      console.error(`[BULK_CV] Blob upload failed:`, blobError.message)
      // Continue without blob - we still have the parsed data
    }

    // Build knetProfile
    const knetProfile = {
      degreeBucket: parsedCV.education?.[0]?.degree || 'Others',
      yearsOfExperienceBucket: parsedCV.experience?.length 
        ? (parsedCV.experience.length > 3 ? '3-5 years' : '0-2 years')
        : 'Fresh Graduate',
      areaOfInterest: parsedCV.skills?.technical?.[0] || 'Technology',
    }

    // Insert candidate
    const insertResult = await sql`
      INSERT INTO candidates (
        org_id,
        email,
        full_name,
        phone,
        field_of_study,
        area_of_interest,
        degree,
        years_of_experience,
        cv_type,
        cv_blob_key,
        parse_status,
        source,
        knet_profile,
        cv_json,
        created_at
      ) VALUES (
        ${orgId}::uuid,
        ${parsedCV.email?.toLowerCase() || null},
        ${parsedCV.fullName || 'Unknown'},
        ${parsedCV.phone || null},
        ${parsedCV.education?.[0]?.field || null},
        ${parsedCV.skills?.technical?.[0] || null},
        ${knetProfile.degreeBucket},
        ${knetProfile.yearsOfExperienceBucket},
        'uploaded'::cv_type_enum,
        ${blobUrl || null},
        'completed'::parse_status_enum,
        'bulk_import',
        ${JSON.stringify(knetProfile)}::jsonb,
        ${JSON.stringify({
          fullName: parsedCV.fullName,
          email: parsedCV.email,
          phone: parsedCV.phone,
          education: parsedCV.education,
          experience: parsedCV.experience,
          skills: parsedCV.skills,
          projects: parsedCV.projects,
          summary: parsedCV.summary,
          parseMethod: parsedCV.parseMethod,
          confidence: parsedCV.confidence
        })}::jsonb,
        NOW()
      )
      RETURNING id::text as id
    `

    const candidateId = insertResult.rows[0].id

    // Store extracted text for search
    try {
      await sql`
        INSERT INTO cv_analysis (candidate_id, org_id, extracted_text, word_count, created_at)
        VALUES (
          ${candidateId}::uuid,
          ${orgId}::uuid,
          ${parsedCV.rawText || ''},
          ${parsedCV.wordCount || 0},
          NOW()
        )
        ON CONFLICT (candidate_id) DO UPDATE SET
          extracted_text = EXCLUDED.extracted_text,
          word_count = EXCLUDED.word_count
      `
    } catch (err) {
      console.warn('[BULK_CV] cv_analysis insert failed:', err)
    }

    console.log(`[BULK_CV] Created candidate: ${candidateId} - ${parsedCV.fullName}`)

    return NextResponse.json({
      success: true,
      fileName,
      candidateId,
      candidate: {
        id: candidateId,
        fullName: parsedCV.fullName,
        email: parsedCV.email,
        phone: parsedCV.phone,
        skills: parsedCV.skills?.technical?.slice(0, 5) || [],
        confidence: parsedCV.confidence,
        parseMethod: parsedCV.parseMethod
      }
    })

  } catch (error: any) {
    console.error('[BULK_CV] Error:', error)
    return NextResponse.json(
      {
        error: 'Import failed',
        message: error?.message
      },
      { status: 500 }
    )
  }
}
