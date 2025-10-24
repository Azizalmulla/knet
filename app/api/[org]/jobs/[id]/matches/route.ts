import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import OpenAI from 'openai'

// Lazy initialize OpenAI to avoid build-time errors
function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

interface MatchedCandidate {
  id: string
  full_name: string
  email: string
  phone: string | null
  field_of_study: string | null
  years_of_experience: string | null
  gpa: number | null
  cv_url: string | null
  similarity_score: number
  match_percentage: number
  match_reason: string
  highlights: string[]
}

export async function GET(
  req: NextRequest,
  { params }: { params: { org: string; id: string } }
) {
  try {
    const supabase = await createServerClient()
    const { org: orgSlug, id: jobId } = params

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Verify user has access to this org
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', org.id)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .eq('organization_id', org.id)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Check if embeddings are enabled
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ 
        error: 'AI matching not configured',
        matches: []
      }, { status: 200 })
    }

    // Generate job embedding
    const jobText = `${job.title}\n${job.description}\n${job.requirements || ''}\n${job.responsibilities || ''}\n${(job.required_skills || []).join(', ')}`
    
    const openai = getOpenAI()
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: jobText,
    })

    const jobEmbedding = embeddingResponse.data[0].embedding

    // Find top candidates using vector similarity
    const { data: candidates, error: candidatesError } = await supabase.rpc(
      'match_candidates_to_job',
      {
        job_embedding: jobEmbedding,
        org_id: org.id,
        match_threshold: 0.7,
        match_count: 10
      }
    )

    if (candidatesError) {
      console.error('Error matching candidates:', candidatesError)
      // Fall back to getting recent candidates
      const { data: fallbackCandidates } = await supabase
        .from('candidates')
        .select('id, full_name, email, phone, field_of_study, years_of_experience, gpa, cv_url')
        .eq('organization_id', org.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (!fallbackCandidates || fallbackCandidates.length === 0) {
        return NextResponse.json({ 
          matches: [],
          message: 'No candidates available yet'
        })
      }

      // Return top 5 without AI matching
      return NextResponse.json({
        matches: fallbackCandidates.slice(0, 5).map((c, idx) => ({
          ...c,
          similarity_score: 0,
          match_percentage: 0,
          match_reason: 'Recent candidate',
          highlights: []
        }))
      })
    }

    // Get AI explanations for top matches
    const topCandidates = candidates?.slice(0, 5) || []
    const matches: MatchedCandidate[] = []

    for (const candidate of topCandidates) {
      try {
        // Generate match explanation
        const explanation = await generateMatchExplanation(job, candidate)
        
        matches.push({
          id: candidate.id,
          full_name: candidate.full_name,
          email: candidate.email,
          phone: candidate.phone,
          field_of_study: candidate.field_of_study,
          years_of_experience: candidate.years_of_experience,
          gpa: candidate.gpa,
          cv_url: candidate.cv_url,
          similarity_score: candidate.similarity || 0,
          match_percentage: Math.round((candidate.similarity || 0) * 100),
          match_reason: explanation.reason,
          highlights: explanation.highlights
        })
      } catch (error) {
        console.error('Error generating explanation for candidate:', error)
        // Add candidate without explanation
        matches.push({
          id: candidate.id,
          full_name: candidate.full_name,
          email: candidate.email,
          phone: candidate.phone,
          field_of_study: candidate.field_of_study,
          years_of_experience: candidate.years_of_experience,
          gpa: candidate.gpa,
          cv_url: candidate.cv_url,
          similarity_score: candidate.similarity || 0,
          match_percentage: Math.round((candidate.similarity || 0) * 100),
          match_reason: 'Good match based on profile',
          highlights: []
        })
      }
    }

    return NextResponse.json({ matches })

  } catch (error: any) {
    console.error('Error in job matches API:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

async function generateMatchExplanation(job: any, candidate: any) {
  try {
    const prompt = `You are analyzing why a candidate is a good match for a job.

Job:
- Title: ${job.title}
- Description: ${job.description?.substring(0, 300)}
- Required Skills: ${(job.required_skills || []).join(', ')}
- Experience Level: ${job.experience_level || 'Not specified'}
- Location: ${job.location || 'Not specified'}

Candidate:
- Name: ${candidate.full_name}
- Field of Study: ${candidate.field_of_study || 'Not specified'}
- Years of Experience: ${candidate.years_of_experience || 'Not specified'}
- GPA: ${candidate.gpa || 'Not specified'}

Provide:
1. A brief 1-sentence reason why this is a good match
2. 2-3 specific highlights (bullet points)

Return ONLY valid JSON in this exact format:
{
  "reason": "Brief one-sentence explanation",
  "highlights": ["Highlight 1", "Highlight 2", "Highlight 3"]
}`

    const openai = getOpenAI()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 200,
    })

    const content = response.choices[0].message.content
    if (!content) {
      throw new Error('No content from AI')
    }

    // Try to parse JSON
    const parsed = JSON.parse(content)
    
    return {
      reason: parsed.reason || 'Good match based on profile',
      highlights: parsed.highlights || []
    }
  } catch (error) {
    console.error('Error generating match explanation:', error)
    return {
      reason: 'Good match based on profile and experience',
      highlights: []
    }
  }
}
