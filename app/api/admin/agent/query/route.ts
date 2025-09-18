import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@vercel/postgres';
import { checkRateLimitWithConfig, createRateLimitResponse } from '@/lib/rateLimit';
import OpenAI from 'openai';

// Schema for AI plan
const AIPlanSchema = z.object({
  intent: z.enum(['rank_candidates', 'filter', 'clarify']),
  filters: z.object({
    fieldOfStudy: z.string().nullable(),
    areaOfInterest: z.string().nullable(),
    location: z.string().nullable(),
    mustHaveSkills: z.array(z.string()).nullable(),
    niceToHaveSkills: z.array(z.string()).nullable(),
    minGpa: z.number().nullable(),
    minYearsExperience: z.number().nullable(),
    languages: z.array(z.string()).nullable(),
    cvType: z.enum(['uploaded', 'generated', 'both']).nullable(),
    graduationYearFrom: z.number().nullable(),
    graduationYearTo: z.number().nullable(),
  }),
  rank_by: z.array(z.enum([
    'gpa', 'awards', 'experience_count', 'internships',
    'project_impact', 'skills_match', 'language_match', 'recent_grad'
  ])),
  limit: z.number(),
  needs_clarification: z.boolean(),
  clarify_question: z.string().nullable(),
  rationale: z.string(),
});

type AIPlan = z.infer<typeof AIPlanSchema>;

// Helper to call OpenAI
async function callAIModel(message: string): Promise<AIPlan> {
  const systemPrompt = `You are the KNET Admin Recruiting Agent.

Goal:
- Turn a recruiter's natural language into a structured search plan over our student CV database.
- Always return STRICT JSON that matches the schema below (no extra text).
- ALWAYS RETURN RESULTS. Only ask for clarification if the query is completely empty or nonsensical.

Data you can assume exists per student:
- fullName, email, phone, location
- fieldOfStudy, areaOfInterest, languages
- gpa (0–4), graduationDate
- experience: [{ company, title, startDate, endDate, bullets[] }]
- projects: [{ name, description, bullets[], technologies[] }]
- skills: { technical[], soft[], languages[] }
- awards[], certificates[]
- cvType ("uploaded" | "generated")

Ranking signals you may use:
- gpa, awards count, internships count, experience count, notable projects, match to required skills, language match, location proximity, recent graduation.

IMPORTANT:
- ALWAYS try to return results. Default to broad search if request is vague.
- Extract ALL mentioned skills/technologies dynamically from the message.
- Parse GPA requirements (e.g., "GPA > 3.5" means minGpa: 3.5).
- Parse numeric limits (e.g., "top 5" means limit: 5).
- For designers/graphics, infer fieldOfStudy could be "Design", "Art", "Media" or any field.
- For engineers/developers, infer "Computer Science", "Engineering", "Software".
- Default location to Kuwait if not specified.
- Only set needs_clarification: true if the message is completely empty or makes no sense.

Output JSON schema (strict):
{
  "intent": "rank_candidates" | "filter" | "clarify",
  "filters": {
    "fieldOfStudy": string | null,
    "areaOfInterest": string | null,
    "location": string | null,
    "mustHaveSkills": string[] | null,
    "niceToHaveSkills": string[] | null,
    "minGpa": number | null,
    "minYearsExperience": number | null,
    "languages": string[] | null,
    "cvType": "uploaded" | "generated" | "both" | null,
    "graduationYearFrom": number | null,
    "graduationYearTo": number | null
  },
  "rank_by": [
    "gpa" | "awards" | "experience_count" | "internships" |
    "project_impact" | "skills_match" | "language_match" | "recent_grad"
  ],
  "limit": number,
  "needs_clarification": boolean,
  "clarify_question": string | null,
  "rationale": string
}

Rules:
- Default limit to 10 if not provided.
- If the user asks "most accomplished" or "best", prefer rank_by: ["gpa","awards","project_impact","internships"].
- Extract ALL skills mentioned (React, Figma, Python, etc.) and put in mustHaveSkills, add "skills_match" to rank_by.
- Parse GPA constraints: "GPA > 3.5" → minGpa: 3.5, "high GPA" → minGpa: 3.0.
- For designers: look for "design", "graphics", "UI/UX", "Figma", "Adobe" → fieldOfStudy can be flexible.
- For developers: look for "developer", "engineer", "programmer" → fieldOfStudy: "Computer Science" or "Engineering".
- If user mentions a location, set filters.location.
- NEVER set needs_clarification unless query is empty. Always attempt to return results.`;

  const userPrompt = `Admin message:
${message}

Context:
We are in Kuwait. If the admin does not specify location, assume Kuwait.
The database column names are: fullName, email, fieldOfStudy, areaOfInterest, gpa, graduationDate, cvType.
Use "Computer Science" when the admin says CS.
Only return the JSON plan per the schema. No extra text.`;

  // Use OpenAI if available, otherwise use fallback
  if (process.env.OPENAI_API_KEY) {
    try {
      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: 'json_object' }
      });

      const content = completion.choices?.[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        return AIPlanSchema.parse(parsed);
      }
    } catch (error) {
      console.error('OpenAI call failed:', error);
    }
  }

  // Enhanced fallback parser for when OpenAI fails
  const lowerMessage = message.toLowerCase();
  const plan: AIPlan = {
    intent: 'rank_candidates',
    filters: {
      fieldOfStudy: null,
      areaOfInterest: null,
      location: 'Kuwait',
      mustHaveSkills: null,
      niceToHaveSkills: null,
      minGpa: null,
      minYearsExperience: null,
      languages: null,
      cvType: 'both',
      graduationYearFrom: null,
      graduationYearTo: null,
    },
    rank_by: ['skills_match', 'gpa', 'experience_count'],
    limit: 10,
    needs_clarification: false,
    clarify_question: null,
    rationale: 'Searching for candidates based on your criteria'
  };

  // Parse field of study
  if (lowerMessage.includes('cs ') || lowerMessage.includes('computer science')) {
    plan.filters.fieldOfStudy = 'Computer Science';
  } else if (lowerMessage.includes('engineering') || lowerMessage.includes('engineer')) {
    plan.filters.fieldOfStudy = 'Engineering';
  } else if (lowerMessage.includes('design') || lowerMessage.includes('graphics') || lowerMessage.includes('ui')) {
    plan.filters.fieldOfStudy = 'Design';
  } else if (lowerMessage.includes('business')) {
    plan.filters.fieldOfStudy = 'Business';
  }

  // Parse GPA requirements
  const gpaMatch = lowerMessage.match(/gpa\s*[>>=]+\s*([\d.]+)/);
  if (gpaMatch) {
    plan.filters.minGpa = parseFloat(gpaMatch[1]);
    plan.rank_by.unshift('gpa');
  } else if (lowerMessage.includes('high gpa') || lowerMessage.includes('good gpa')) {
    plan.filters.minGpa = 3.0;
    plan.rank_by.unshift('gpa');
  }

  // Parse ranking criteria
  if (lowerMessage.includes('best') || lowerMessage.includes('most accomplished') || lowerMessage.includes('top')) {
    plan.rank_by = ['gpa', 'awards', 'project_impact', 'skills_match', 'internships'];
    plan.rationale = 'Ranking by overall achievement';
  }

  // Dynamic skill extraction
  const skills: string[] = [];
  const skillPatterns = [
    'react', 'angular', 'vue', 'typescript', 'javascript', 'python', 'java', 'c++',
    'figma', 'adobe', 'photoshop', 'illustrator', 'sketch',
    'node', 'django', 'flask', 'spring', 'aws', 'docker', 'kubernetes',
    'sql', 'mongodb', 'postgresql', 'mysql', 'firebase'
  ];
  
  skillPatterns.forEach(skill => {
    if (lowerMessage.includes(skill)) {
      skills.push(skill.charAt(0).toUpperCase() + skill.slice(1));
    }
  });
  
  if (skills.length > 0) {
    plan.filters.mustHaveSkills = skills;
    plan.rank_by.unshift('skills_match');
  }

  // Parse area of interest
  if (lowerMessage.includes('web') || lowerMessage.includes('frontend') || lowerMessage.includes('backend')) {
    plan.filters.areaOfInterest = 'Web Development';
  } else if (lowerMessage.includes('mobile') || lowerMessage.includes('ios') || lowerMessage.includes('android')) {
    plan.filters.areaOfInterest = 'Mobile Development';
  } else if (lowerMessage.includes('ai') || lowerMessage.includes('machine learning') || lowerMessage.includes('ml')) {
    plan.filters.areaOfInterest = 'AI/ML';
  }

  // Parse limit
  const limitMatch = lowerMessage.match(/top (\d+)|first (\d+)|(\d+) candidates?/);
  if (limitMatch) {
    const num = limitMatch[1] || limitMatch[2] || limitMatch[3];
    plan.limit = Math.min(parseInt(num), 50);
  }

  return plan;
}

// Query database based on AI plan
async function queryDatabase(plan: AIPlan, adminMessage: string) {
  try {
    // Ensure GPA column exists (idempotent for older schemas)
    try {
      await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS gpa NUMERIC(3,2)`;
    } catch {}

    // Build WHERE clauses
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (plan.filters.fieldOfStudy) {
      conditions.push(`field_of_study ILIKE $${paramIndex}`);
      params.push(`%${plan.filters.fieldOfStudy}%`);
      paramIndex++;
    }

    if (plan.filters.areaOfInterest) {
      conditions.push(`area_of_interest ILIKE $${paramIndex}`);
      params.push(`%${plan.filters.areaOfInterest}%`);
      paramIndex++;
    }

    if (plan.filters.cvType && plan.filters.cvType !== 'both') {
      conditions.push(`cv_type = $${paramIndex}`);
      params.push(plan.filters.cvType === 'generated' ? 'ai' : plan.filters.cvType);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Basic lexical search over extracted CV text (cv_text)
    const baseQuery = `
      SELECT 
        s.id,
        s.full_name as "fullName",
        s.email,
        s.phone,
        s.field_of_study as "fieldOfStudy",
        s.area_of_interest as "areaOfInterest",
        s.submitted_at,
        t.text as parsed_text,
        s.gpa as gpa,
        s.cv_url as cv_url,
        s.cv_parse_status as cv_parse_status
      FROM students s
      LEFT JOIN cv_text t ON t.student_id = s.id
      ${whereClause}
      ORDER BY s.submitted_at DESC
      LIMIT ${Math.max(plan.limit, 10)}
    `;
    let rows: any[] = [];
    try {
      const vres = await sql.query(baseQuery, params);
      rows = vres.rows as any[];

    // Score with simple lexical signals (mustHaveSkills + query terms)
    const queryTerms = (plan.filters.mustHaveSkills || [])
      .map(s => String(s).toLowerCase())
      .filter(Boolean);
    const adminTerms = String(adminMessage || '')
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/)
      .filter(Boolean);

    const ranked = rows.map(r => {
        // Metadata matching score
        let metaScore = 0;
        let fieldBoost = false;
        let areaBoost = false;
        if (plan.filters.fieldOfStudy && r.fieldOfStudy) {
          const fieldMatch = String(r.fieldOfStudy).toLowerCase().includes(String(plan.filters.fieldOfStudy).toLowerCase());
          if (fieldMatch) metaScore += 0.5;
          if (fieldMatch) fieldBoost = true;
        }
        if (plan.filters.areaOfInterest && r.areaOfInterest) {
          const areaMatch = String(r.areaOfInterest).toLowerCase().includes(String(plan.filters.areaOfInterest).toLowerCase());
          if (areaMatch) metaScore += 0.5;
          if (areaMatch) areaBoost = true;
        }
        
        // GPA score (normalized to 0-1); do not fabricate GPA
        const gpaVal: number | null = (r as any).gpa != null ? Number((r as any).gpa) : null;
        const hasGpa = Number.isFinite(gpaVal as number);
        const gpaScoreRaw = hasGpa ? (Number(gpaVal) / 4.0) : 0;
        const gpaReason = hasGpa ? `GPA ${Number(gpaVal).toFixed(2)}` : null;
        
        // Lexical similarity: count matches of terms in parsed_text
        const textLower = (r.parsed_text || '').toLowerCase();
        let termHits = 0;
        queryTerms.forEach(t => { if (t && textLower.includes(t)) termHits += 1; });
        // Add light weight for general admin terms
        adminTerms.forEach(t => { if (t.length > 3 && textLower.includes(t)) termHits += 0.1; });

        // Normalize lexical score to 0..1 (cap at 10 matches)
        const simScore = Math.min(termHits / 10, 1);

        // Recency boost: newer submissions slightly favored
        const monthsAgo = (Date.now() - new Date(r.submitted_at).getTime()) / (1000 * 60 * 60 * 24 * 30);
        const recencyScore = Math.max(0, 1 - (monthsAgo / 24)); // decay over 24 months

        // Combine: sim 0.6, gpa 0.2, meta 0.15, recency 0.05
        const weights = { sim: 0.6, gpa: 0.2, meta: 0.15, recency: 0.05 };
        const finalScore = (
          weights.sim * simScore +
          weights.gpa * gpaScoreRaw +
          weights.meta * Math.min(metaScore, 1) +
          weights.recency * recencyScore
        );
        
        // Extract real project highlights from parsed CV text
        const projectHighlights: string[] = [];
        const matchedSkills: string[] = [];
        
        if (r.parsed_text) {
          const cvText = r.parsed_text.toLowerCase();
          const sentences = r.parsed_text.split(/[.!?]+/).filter((s: string) => s.trim().length > 10);
          
          // Find matched skills from the query
          if (plan.filters.mustHaveSkills) {
            plan.filters.mustHaveSkills.forEach(skill => {
              if (cvText.includes(skill.toLowerCase())) {
                matchedSkills.push(skill);
              }
            });
          }
          
          // Extract project/achievement bullets
          const bulletPatterns = [
            /developed?\s+[^.]+/gi,
            /built\s+[^.]+/gi,
            /created?\s+[^.]+/gi,
            /designed?\s+[^.]+/gi,
            /implemented?\s+[^.]+/gi,
            /led\s+[^.]+/gi,
            /managed?\s+[^.]+/gi,
            /achieved?\s+[^.]+/gi,
            /improved?\s+[^.]+/gi,
            /launched?\s+[^.]+/gi
          ];
          
          for (const pattern of bulletPatterns) {
            const matches = r.parsed_text.match(pattern);
            if (matches) {
              matches.slice(0, 2).forEach((match: string) => {
                const cleaned = match.trim().substring(0, 100);
                if (cleaned.length > 20 && !projectHighlights.some(h => h.includes(cleaned.substring(0, 30)))) {
                  projectHighlights.push(cleaned.charAt(0).toUpperCase() + cleaned.slice(1));
                }
              });
            }
            if (projectHighlights.length >= 4) break;
          }
          
          // If no bullets found, extract relevant experience lines
          if (projectHighlights.length === 0) {
            sentences.slice(0, 10).forEach((sentence: string) => {
              const s = sentence.trim();
              if ((s.includes('experience') || s.includes('project') || s.includes('work') || 
                   s.includes('intern') || s.includes('develop') || s.includes('design')) &&
                  s.length > 30 && s.length < 150) {
                projectHighlights.push(s.charAt(0).toUpperCase() + s.slice(1));
              }
            });
          }
        }
        
        // Fallback if no text available
        if (projectHighlights.length === 0) {
          projectHighlights.push('Limited CV text available - showing submission data');
        }
        
        // Clean up field of study label
        let fieldLabel = r.fieldOfStudy || '';
        if (!fieldLabel && r.parsed_text) {
          const textLower = r.parsed_text.toLowerCase();
          if (textLower.includes('computer science') || textLower.includes('software')) {
            fieldLabel = 'Computer Science';
          } else if (textLower.includes('design') || textLower.includes('graphic') || textLower.includes('visual')) {
            fieldLabel = 'Visual Communication / Design';
          } else if (textLower.includes('business') || textLower.includes('management')) {
            fieldLabel = 'Business Management';
          } else if (textLower.includes('engineering')) {
            fieldLabel = 'Engineering';
          } else {
            fieldLabel = 'Not specified';
          }
        }
        
        // Experience proxy count (for display only)
        const textForExp = (r.parsed_text as string | null) || '';
        const experienceCount = (textForExp.match(/\b(intern|project|experience)\b/gi) || []).length;

        // Reasons
        const reasons: string[] = [];
        matchedSkills.slice(0, 2).forEach(s => reasons.push(`Matched "${s}"`));
        if (fieldBoost && r.fieldOfStudy) reasons.push(`Boost: Field ${r.fieldOfStudy}`);
        if (areaBoost && r.areaOfInterest) reasons.push(`Boost: Area ${r.areaOfInterest}`);
        if (gpaReason) reasons.push(gpaReason);
        if (recencyScore > 0.7) reasons.push('Recent submission');

        return {
          id: r.id,
          fullName: r.fullName,
          email: r.email,
          phone: (r as any).phone || null,
          fieldOfStudy: fieldLabel || null,
          areaOfInterest: r.areaOfInterest || null,
          gpa: hasGpa ? Number(Number(gpaVal).toFixed(2)) : null,
          cvUrl: (r as any).cv_url || null,
          score: Math.round(finalScore * 100),
          parseStatus: (r as any).cv_parse_status || null,
          why: reasons.slice(0, 3),
          highlights: projectHighlights.slice(0, 3),
          download: (r as any).cv_url || null,
          // legacy fields for panel compatibility
          experienceCount,
          projectHighlights: projectHighlights.slice(0, 4),
          matchedSkills,
          whyPicked: reasons.slice(0, 3).join(' | '),
          awards: [],
          cv_url_pdf: null,
          cv_url_html: (r as any).cv_url || null
        };
      });
      
      // Deduplicate by email lowercase or id, prefer with non-null GPA
      const dedupMap = new Map<string, any>();
      for (const row of ranked) {
        const key = (row.email || '').toLowerCase() || String(row.id);
        const existing = dedupMap.get(key);
        if (!existing) {
          dedupMap.set(key, row);
        } else {
          const pick = (existing.gpa != null ? existing : row.gpa != null ? row : existing);
          dedupMap.set(key, pick);
        }
      }
      let filtered = Array.from(dedupMap.values());
      if (plan.filters.minGpa && plan.filters.minGpa > 0) {
        filtered = filtered.filter((r: any) => r.gpa != null && r.gpa >= plan.filters.minGpa!);
      }
      filtered.sort((a: any, b: any) => b.score - a.score);
      return filtered;
    } catch (e) {
      // Fallback: basic metadata + optional parsed text from cv_text
      const query = `
        SELECT 
          s.id,
          s.full_name as "fullName",
          s.email,
          s.field_of_study as "fieldOfStudy",
          s.area_of_interest as "areaOfInterest",
          s.submitted_at,
          t.text as parsed_text,
          s.gpa as gpa
        FROM students s
        LEFT JOIN cv_text t ON t.student_id = s.id
        ${whereClause}
        ORDER BY s.submitted_at DESC
        LIMIT ${plan.limit}
      `;
      const result = await sql.query(query, params);
      const students = result.rows as any[];
      const scoredStudents = students.map((student: any) => {
        // GPA handling
        const gpaVal: number | null = student.gpa != null ? Number(student.gpa) : null;
        const hasGpa = Number.isFinite(gpaVal as number);
        const gpaScoreRaw = hasGpa ? Number(gpaVal) / 4.0 : 0;
        const textForExp = (student.parsed_text as string | null) || '';
        const experienceCount = (textForExp.match(/\b(intern|project|experience)\b/gi) || []).length;
        // Without similarity, score reduces to GPA only if present
        const score = hasGpa ? (0.3 * gpaScoreRaw) : 0;
        
        return {
          id: student.id,
          fullName: student.fullName,
          email: student.email,
          fieldOfStudy: student.fieldOfStudy || 'Not specified',
          gpa: hasGpa ? Number(Number(gpaVal).toFixed(2)) : null,
          experienceCount,
          projectHighlights: ['Limited CV text - showing submission data'],
          matchedSkills: [],
          whyPicked: student.fieldOfStudy ? `Matches field: ${student.fieldOfStudy}` : 'Relevant profile',
          awards: [],
          score: Math.round(score * 100),
          cv_url_pdf: null,
          cv_url_html: null
        };
      });
      
      // Deduplicate by email or id
      const dedupMap = new Map<string, any>();
      for (const row of scoredStudents) {
        const key = (row.email || '').toLowerCase() || String(row.id);
        const existing = dedupMap.get(key);
        if (!existing) dedupMap.set(key, row);
        else dedupMap.set(key, existing.gpa != null ? existing : row);
      }
      let filtered = Array.from(dedupMap.values());
      if (plan.filters.minGpa && plan.filters.minGpa > 0) {
        filtered = filtered.filter((s: any) => s.gpa != null && s.gpa >= plan.filters.minGpa!);
      }
      filtered.sort((a: any, b: any) => b.score - a.score);
      return filtered.slice(0, plan.limit);
    }
  } catch (error) {
    console.error('Database query failed:', error);
    return [];
  }
}

export async function POST(request: NextRequest) {
  // Check admin auth (trimmed)
  const provided = (request.headers.get('x-admin-key') || '').trim();
  const envKey = (process.env.ADMIN_KEY || '').trim();
  const fallback = process.env.NODE_ENV !== 'production' ? 'test-admin-key' : '';
  const allowed = [envKey, fallback].filter(Boolean);
  if (!provided || !allowed.includes(provided)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limiting: 10 req / 5 min / IP
  const rl = checkRateLimitWithConfig(request, { 
    maxRequests: 10, 
    windowMs: 5 * 60 * 1000,
    namespace: 'admin-agent' 
  });
  if (!rl.success) return createRateLimitResponse(rl);

  try {
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Get AI plan
    const plan = await callAIModel(message);

    // Handle clarification needed
    if (plan.needs_clarification) {
      return NextResponse.json({
        needsClarification: true,
        clarifyQuestion: plan.clarify_question,
        explanation: plan.rationale,
        filtersApplied: plan.filters
      });
    }

    // Query database using embeddings + metadata
    const results = await queryDatabase(plan, message);

    // Handle no results with actionable tips
    if (!results || results.length === 0) {
      const tips = [
        'Try using broader skill terms (e.g., "developer" instead of specific framework)',
        'Increase the number of results (e.g., "top 20" instead of "top 5")',
        'Include related tools or technologies',
        'Remove specific filters like GPA requirements',
        'Search by field of study instead of specific skills'
      ];
      
      return NextResponse.json({
        results: [],
        explanation: 'No strong matches found for your criteria.',
        tips: tips.slice(0, 3),
        filtersApplied: plan.filters,
        needsClarification: false
      });
    }

    // Return results with complete structure
    return NextResponse.json({
      results,
      explanation: plan.rationale,
      filtersApplied: plan.filters,
      needsClarification: false
    });

  } catch (error) {
    console.error('Agent query error:', error);
    return NextResponse.json({ 
      error: 'Failed to process query',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
