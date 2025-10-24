import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { jwtVerify } from '@/lib/esm-compat/jose'
import { parseCSV, CandidateCSVRow } from '@/lib/csv-parser'
import { normalizeWatheeftiValues } from '@/lib/email-parser'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * CSV Bulk Import Endpoint
 * Accepts CSV file upload and creates multiple candidates
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { org: string } }
) {
  const startTime = Date.now()

  try {
    // Auth check
    const token = request.cookies.get('admin_session')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'fallback'
    )

    try {
      await jwtVerify(token, secret)
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

    console.log('[CSV_IMPORT] Starting import for org:', orgSlug)

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'File must be a CSV' }, { status: 400 })
    }

    // Read file content
    const csvText = await file.text()
    console.log('[CSV_IMPORT] File size:', csvText.length, 'bytes')

    // Parse CSV
    const parseResult = parseCSV(csvText)

    if (!parseResult.success) {
      return NextResponse.json({
        error: 'CSV parsing failed',
        errors: parseResult.errors,
        warnings: parseResult.warnings
      }, { status: 400 })
    }

    console.log('[CSV_IMPORT] Parsed:', {
      totalRows: parseResult.totalRows,
      validRows: parseResult.validRows,
      errors: parseResult.errors.length,
      warnings: parseResult.warnings.length
    })

    // Insert candidates in batch
    let createdCount = 0
    let updatedCount = 0
    let failedCount = 0
    const failedRows: Array<{ row: number; email: string; error: string }> = []

    for (let i = 0; i < parseResult.rows.length; i++) {
      const row = parseResult.rows[i]
      const rowNum = i + 1

      try {
        // Check if candidate exists
        const existingResult = await sql`
          SELECT id FROM candidates 
          WHERE org_id = ${orgId}::uuid 
            AND email = ${row.email || ''}
          LIMIT 1
        `

        // Normalize Watheefti values
        const normalized = normalizeWatheeftiValues({
          full_name: row.full_name,
          email: row.email,
          phone: row.phone ?? null,
          field_of_study: row.field_of_study ?? null,
          area_of_interest: row.area_of_interest ?? null,
          gpa: typeof row.gpa === 'number' ? row.gpa : null,
          degree: row.degree ?? null,
          years_of_experience: row.years_of_experience ?? null,
          raw_text: ''
        })

        if (existingResult.rows.length > 0) {
          // Update existing candidate
          await sql`
            UPDATE candidates
            SET
              full_name = COALESCE(${row.full_name}, full_name),
              phone = COALESCE(${row.phone}, phone),
              field_of_study = COALESCE(${row.field_of_study}, field_of_study),
              area_of_interest = COALESCE(${row.area_of_interest}, area_of_interest),
              gpa = COALESCE(${row.gpa}, gpa),
              degree = COALESCE(${normalized.degree}, degree),
              years_of_experience = COALESCE(${normalized.yearsOfExperience}, years_of_experience),
              knet_profile = COALESCE(
                jsonb_build_object(
                  'degreeBucket', ${normalized.degree},
                  'yearsOfExperienceBucket', ${normalized.yearsOfExperience},
                  'areaOfInterest', ${normalized.areaOfInterest}
                ),
                knet_profile
              )
            WHERE id = ${existingResult.rows[0].id}::uuid
          `
          updatedCount++
        } else {
          // Create new candidate
          await sql`
            INSERT INTO candidates (
              org_id,
              email,
              full_name,
              phone,
              field_of_study,
              area_of_interest,
              gpa,
              degree,
              years_of_experience,
              cv_type,
              parse_status,
              source,
              knet_profile,
              created_at
            ) VALUES (
              ${orgId}::uuid,
              ${row.email || null},
              ${row.full_name || null},
              ${row.phone ?? null},
              ${row.field_of_study ?? null},
              ${row.area_of_interest ?? null},
              ${row.gpa ?? null},
              ${normalized.degree ?? null},
              ${normalized.yearsOfExperience ?? null},
              'uploaded',
              'pending'::parse_status_enum,
              'csv_import',
              ${JSON.stringify({
                degreeBucket: normalized.degree,
                yearsOfExperienceBucket: normalized.yearsOfExperience,
                areaOfInterest: normalized.areaOfInterest
              })},
              NOW()
            )
          `
          createdCount++
        }
      } catch (error: any) {
        console.error(`[CSV_IMPORT] Row ${rowNum} failed:`, error.message)
        failedCount++
        failedRows.push({
          row: rowNum,
          email: row.email || row.full_name || 'unknown',
          error: error.message
        })
      }
    }

    // Log import event
    await sql`
      INSERT INTO import_log (
        org_id,
        source,
        source_email,
        candidate_count,
        success_count,
        failed_count,
        metadata,
        created_at
      ) VALUES (
        ${orgId}::uuid,
        'csv_import',
        NULL,
        ${parseResult.validRows},
        ${createdCount + updatedCount},
        ${failedCount},
        ${JSON.stringify({
          filename: file.name,
          fileSize: csvText.length,
          totalRows: parseResult.totalRows,
          warnings: parseResult.warnings,
          failedRows
        })},
        NOW()
      )
    `.catch(err => console.error('[CSV_IMPORT] Log insert failed:', err))

    const processingTime = Date.now() - startTime

    console.log('[CSV_IMPORT] Complete:', {
      created: createdCount,
      updated: updatedCount,
      failed: failedCount,
      time: processingTime
    })

    return NextResponse.json({
      success: true,
      totalRows: parseResult.totalRows,
      validRows: parseResult.validRows,
      created: createdCount,
      updated: updatedCount,
      failed: failedCount,
      warnings: parseResult.warnings,
      failedRows,
      processingTime
    })

  } catch (error: any) {
    console.error('[CSV_IMPORT] Error:', error)
    return NextResponse.json(
      {
        error: 'Import failed',
        message: error?.message,
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    )
  }
}
