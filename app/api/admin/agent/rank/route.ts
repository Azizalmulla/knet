import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import OpenAI from 'openai';
import { sql } from '@vercel/postgres';
import { checkRateLimit } from '@/lib/rateLimit';
import { safeLog } from '@/lib/redact';
import { careerMap } from '@/lib/career-map';

// Request schema
const RankRequestSchema = z.object({
  role: z.object({
    title: z.string().min(1),
    must: z.array(z.string()).default([]),
    nice: z.array(z.string()).default([]),
    minYears: z.number().min(0).default(0),
    language: z.string().optional(),
    location: z.string().optional(),
  }),
  topK: z.number().min(1).max(50).default(10),
  filters: z.object({
    fieldOfStudy: z.string().optional(),
    areaOfInterest: z.string().optional(),
    graduationYear: z.number().optional(),
    minGPA: z.number().optional(),
    language: z.enum(['en', 'ar', 'both']).optional(),
  }).optional(),
});

// Verify admin auth
function verifyAdmin(request: NextRequest): boolean {
  const provided = (request.headers.get('x-admin-key') || '').trim();
  const envKey = (process.env.ADMIN_KEY || '').trim();
  const fallback = process.env.NODE_ENV !== 'production' ? 'test-admin-key' : '';
  if (!provided) return false;
  return [envKey, fallback].filter(Boolean).includes(provided);
}

// Calculate text embeddings (using simple TF-IDF for MVP, can upgrade to OpenAI embeddings)
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size; // Jaccard similarity
}

// Score a candidate against role requirements
function scoreCandidate(candidate: any, roleSpec: any): number {
  let score = 0;
  
  // Must-have skills (40%)
  const mustHaveMatches = roleSpec.must.filter((skill: string) => {
    const skillLower = skill.toLowerCase();
    return (
      candidate.skills?.technical?.some((s: string) => s.toLowerCase().includes(skillLower)) ||
      candidate.parsedText?.toLowerCase().includes(skillLower)
    );
  });
  score += (mustHaveMatches.length / Math.max(roleSpec.must.length, 1)) * 40;
  
  // Nice-to-have skills (25%)
  const niceHaveMatches = roleSpec.nice.filter((skill: string) => {
    const skillLower = skill.toLowerCase();
    return (
      candidate.skills?.technical?.some((s: string) => s.toLowerCase().includes(skillLower)) ||
      candidate.parsedText?.toLowerCase().includes(skillLower)
    );
  });
  score += (niceHaveMatches.length / Math.max(roleSpec.nice.length, 1)) * 25;
  
  // Field/Area alignment (15%)
  const roleTitle = roleSpec.title.toLowerCase();
  const candidateVacancies = candidate.suggestedVacancies?.toLowerCase() || '';
  const candidateArea = candidate.areaOfInterest?.toLowerCase() || '';
  
  if (candidateVacancies.includes(roleTitle.split(' ')[0]) || candidateArea.includes(roleTitle.split(' ')[0])) {
    score += 15;
  } else if (candidate.fieldOfStudy && careerMap[candidate.fieldOfStudy]) {
    // Check if role aligns with career map
    const areas = careerMap[candidate.fieldOfStudy];
    if (Object.values(areas).some((vacancies: any) => 
      vacancies.some((v: string) => v.toLowerCase().includes(roleTitle.split(' ')[0]))
    )) {
      score += 10;
    }
  }
  
  // Experience years (10%)
  const yearsExperience = candidate.experience?.length || 0;
  if (yearsExperience >= roleSpec.minYears) {
    score += 10;
  } else if (yearsExperience > 0) {
    score += 5;
  }
  
  // Language match (5%)
  if (roleSpec.language) {
    const hasLanguage = candidate.languages?.some((l: string) => 
      l.toLowerCase().includes(roleSpec.language.toLowerCase())
    );
    if (hasLanguage) score += 5;
  }
  
  // Project relevance (5%)
  const hasRelevantProjects = candidate.projects?.some((p: any) => {
    const projectText = `${p.name} ${p.description}`.toLowerCase();
    return roleSpec.must.some((skill: string) => projectText.includes(skill.toLowerCase()));
  });
  if (hasRelevantProjects) score += 5;
  
  return Math.min(100, Math.round(score));
}

export async function POST(request: NextRequest) {
  try {
    // Check admin auth
    if (!verifyAdmin(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Rate limiting
    const rateLimit = checkRateLimit(request);
    
    if (!rateLimit.success) {
      return NextResponse.json({
        error: 'Too many requests. Please try again later.',
        resetTime: rateLimit.resetTime,
      }, { status: 429 });
    }
    
    // Parse request
    const body = await request.json();
    const validated = RankRequestSchema.parse(body);
    
    // Audit logging (PII-safe)
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    safeLog('[AI Agent] Query received', {
      role: validated.role.title,
      mustCount: validated.role.must.length,
      niceCount: validated.role.nice.length,
      minYears: validated.role.minYears,
      filters: validated.filters,
      ip,
      timestamp: new Date().toISOString(),
    });
    
    // Fetch candidates from DB with pre-filtering
    let whereConditions = [];
    let queryParams: any[] = [];
    
    if (validated.filters?.fieldOfStudy) {
      whereConditions.push('field_of_study = $' + (queryParams.length + 1));
      queryParams.push(validated.filters.fieldOfStudy);
    }
    if (validated.filters?.areaOfInterest) {
      whereConditions.push('area_of_interest = $' + (queryParams.length + 1));
      queryParams.push(validated.filters.areaOfInterest);
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    const { rows: candidates } = await sql.query(`
      SELECT 
        id as "studentId",
        full_name as "fullName",
        email,
        field_of_study as "fieldOfStudy",
        area_of_interest as "areaOfInterest",
        suggested_vacancies as "suggestedVacancies",
        cv_data as "cvData",
        created_at as "createdAt"
      FROM cvs
      ${whereClause}
    `, queryParams);
    
    // Parse CV data and calculate initial scores
    const candidatesWithScores = candidates.map(candidate => {
      let cvData: any = {};
      try {
        cvData = typeof candidate.cvData === 'string' 
          ? JSON.parse(candidate.cvData) 
          : candidate.cvData || {};
      } catch {}
      
      // Create parsed text for similarity matching
      const parsedText = [
        candidate.fieldOfStudy,
        candidate.areaOfInterest,
        candidate.suggestedVacancies,
        cvData.skills?.technical?.join(' '),
        cvData.skills?.soft?.join(' '),
        cvData.experience?.map((e: any) => `${e.position} ${e.company} ${e.bullets?.join(' ')}`).join(' '),
        cvData.projects?.map((p: any) => `${p.name} ${p.description}`).join(' '),
        cvData.education?.map((e: any) => `${e.degree} ${e.fieldOfStudy}`).join(' '),
      ].filter(Boolean).join(' ');
      
      const enrichedCandidate = {
        ...candidate,
        ...cvData,
        parsedText,
      };
      
      const score = scoreCandidate(enrichedCandidate, validated.role);
      
      return { ...enrichedCandidate, score };
    });
    
    // Sort by score and take top candidates
    const topCandidates = candidatesWithScores
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(50, candidatesWithScores.length)); // Pre-filter top 50 for AI analysis
    
    // Use GPT-4o-mini for detailed analysis of top candidates
    let aiResults: any[] = [];
    
    if (topCandidates.length > 0 && process.env.OPENAI_API_KEY) {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      // Prepare candidates for AI analysis (remove PII)
      const candidatesForAI = topCandidates.slice(0, validated.topK).map(c => ({
        studentId: c.studentId,
        fieldOfStudy: c.fieldOfStudy,
        areaOfInterest: c.areaOfInterest,
        suggestedVacancies: c.suggestedVacancies,
        skills: c.skills || {},
        projects: (c.projects || []).map((p: any) => ({
          name: p.name,
          description: p.description,
          technologies: p.technologies,
        })),
        experience: (c.experience || []).map((e: any) => ({
          position: e.position,
          company: e.company,
          duration: e.startDate && e.endDate ? 
            `${e.startDate} - ${e.endDate}` : 'Not specified',
          bullets: e.bullets || [],
        })),
        education: (c.education || []).map((e: any) => ({
          degree: e.degree,
          field: e.fieldOfStudy,
          institution: e.institution,
          gpa: e.gpa,
        })),
        languages: c.languages || [],
        initialScore: c.score,
      }));
      
      const systemPrompt = `You are the Wathefni AI HR Admin Agent. You read structured CV JSON and rank candidates for a role.
Your job is to rank candidates, explain why, and list gaps/risks.
Output strict JSON only. No extra prose.

Scoring guidelines:
- Must-have skills match: 40%
- Nice-to-have skills: 25%
- Field/area alignment: 15%
- Project relevance: 10%
- Language match: 5%
- Experience/recency: 5%

For each candidate provide:
- score: 0-100
- matchedSkills: array of matched must-have and nice-to-have skills
- reasons: exactly 3 concise reasons to hire (max 15 words each)
- gaps: exactly 2 gaps or risks (max 15 words each)
- atsReadiness: "high" (score >75), "medium" (50-75), or "low" (<50)

Be objective and fact-based. Never fabricate information.`;
      
      const userPrompt = `Role specification:
${JSON.stringify(validated.role, null, 2)}

Career map for field/area alignment:
${JSON.stringify(careerMap, null, 2)}

Candidates to analyze:
${JSON.stringify(candidatesForAI, null, 2)}

Analyze these candidates and provide rankings with explanations.`;
      
      try {
        const aiResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 2000,
          response_format: { type: 'json_object' },
        });
        
        const aiAnalysis = JSON.parse(aiResponse.choices[0]?.message?.content || '{}');
        aiResults = aiAnalysis.results || [];
        
      } catch (aiError) {
        console.error('AI analysis error:', aiError);
        // Fallback to basic scoring if AI fails
        aiResults = topCandidates.slice(0, validated.topK).map(c => ({
          studentId: c.studentId,
          score: c.score,
          matchedSkills: validated.role.must.filter((skill: string) => 
            c.parsedText?.toLowerCase().includes(skill.toLowerCase())
          ),
          reasons: [
            'Matches key technical requirements',
            'Relevant educational background',
            'Has project experience',
          ],
          gaps: [
            'Limited years of experience',
            'Missing some nice-to-have skills',
          ],
          atsReadiness: c.score > 75 ? 'high' : c.score > 50 ? 'medium' : 'low',
        }));
      }
    } else {
      // No AI available, use basic scoring
      aiResults = topCandidates.slice(0, validated.topK).map(c => ({
        studentId: c.studentId,
        score: c.score,
        matchedSkills: validated.role.must.filter((skill: string) => 
          c.parsedText?.toLowerCase().includes(skill.toLowerCase())
        ),
        reasons: [
          c.fieldOfStudy ? `${c.fieldOfStudy} background` : 'Relevant education',
          c.projects?.length ? `${c.projects.length} projects` : 'Has projects',
          c.experience?.length ? `${c.experience.length} experiences` : 'Has experience',
        ],
        gaps: [
          validated.role.minYears > (c.experience?.length || 0) ? 
            `Needs ${validated.role.minYears}+ years experience` : 
            'Consider more experience',
          validated.role.nice.length > 0 ? 'Missing nice-to-have skills' : 'Room for growth',
        ],
        atsReadiness: c.score > 75 ? 'high' : c.score > 50 ? 'medium' : 'low',
      }));
    }
    
    // Merge AI results with candidate data
    const finalResults = aiResults.map((aiResult: any) => {
      const candidate = topCandidates.find(c => c.studentId === aiResult.studentId);
      return {
        studentId: aiResult.studentId,
        fullName: candidate?.fullName || 'Unknown',
        email: candidate?.email || '',
        fieldOfStudy: candidate?.fieldOfStudy || '',
        areaOfInterest: candidate?.areaOfInterest || '',
        score: aiResult.score,
        matchedSkills: aiResult.matchedSkills || [],
        reasons: aiResult.reasons || [],
        gaps: aiResult.gaps || [],
        atsReadiness: aiResult.atsReadiness || 'low',
      };
    });
    
    // Create summary
    const summary = {
      role: validated.role.title,
      totalCandidates: candidates.length,
      analyzed: finalResults.length,
      topReasonsAcrossPool: [
        'Strong technical skills alignment',
        'Relevant project experience',
        'Good educational background',
      ],
      topGapsAcrossPool: [
        'Limited industry experience',
        'Missing advanced certifications',
      ],
    };
    
    // Audit log success
    safeLog('[AI Agent] Query completed', {
      role: validated.role.title,
      candidatesFound: candidates.length,
      resultsReturned: finalResults.length,
      timestamp: new Date().toISOString(),
    });
    
    return NextResponse.json({
      success: true,
      summary,
      results: finalResults,
    });
    
  } catch (error: any) {
    console.error('Agent rank error:', error);
    return NextResponse.json({
      error: 'Failed to rank candidates',
      details: error.message,
    }, { status: 500 });
  }
}
