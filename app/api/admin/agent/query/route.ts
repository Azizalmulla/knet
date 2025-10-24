import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from '@vercel/postgres';
import { checkRateLimitWithConfig, createRateLimitResponse } from '@/lib/rateLimit';
import { jwtVerify } from '@/lib/esm-compat/jose';
import { generateQueryEmbedding, cosineSimilarity } from '@/lib/embeddings';

// Schema for AI plan - Made more forgiving to prevent ZodErrors
const AIPlanSchema = z.object({
  intent: z.enum(['rank_candidates', 'filter', 'clarify', 'analyze']).default('rank_candidates'),
  filters: z.object({
    fieldOfStudy: z.string().nullable().optional(),
    areaOfInterest: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    mustHaveSkills: z.array(z.string()).nullable().optional(),
    niceToHaveSkills: z.array(z.string()).nullable().optional(),
    minGpa: z.number().nullable().optional(),
    minYearsExperience: z.number().nullable().optional(),
    languages: z.array(z.string()).nullable().optional(),
    cvType: z.enum(['uploaded','generated','both']).nullable().optional(),
    graduationYearFrom: z.number().nullable().optional(),
    graduationYearTo: z.number().nullable().optional(),
  }).default({}),
  rank_by: z.array(z.enum([
    'gpa','awards','experience_count','internships','project_impact','skills_match','language_match','recent_grad'
  ])).default(['skills_match']),
  limit: z.number().default(20),
  needs_clarification: z.boolean().default(false),
  clarify_question: z.string().nullable().optional(),
  rationale: z.string().default(''),
  analysis_query: z.string().nullable().optional(), // For "analyze" intent
  reference_candidates: z.array(z.string()).nullable().optional(), // Candidate IDs or names from context
});

type AIPlan = z.infer<typeof AIPlanSchema>;

// Helper to handle analysis queries (follow-up questions about candidates)
async function handleAnalysisQuery(
  plan: AIPlan,
  message: string,
  conversationHistory: Array<{role: string, content: string, candidatesMetadata?: any[]}>,
  orgSlug: string
): Promise<any> {
  // Extract structured candidate metadata from recent messages
  let allCandidates: Array<{id: string, fullName: string, email: string, index: number}> = [];
  for (const msg of conversationHistory.slice(-5).reverse()) {
    if (msg.role === 'assistant' && msg.candidatesMetadata && msg.candidatesMetadata.length > 0) {
      allCandidates = msg.candidatesMetadata;
      break; // Use the most recent result set
    }
  }

  if (allCandidates.length === 0) {
    throw new Error('No recent candidates found in conversation. Please search first.');
  }

  // Smart candidate selection
  let selectedCandidate = null;
  const messageLower = message.toLowerCase();

  // Check if GPT extracted a specific name
  if (plan.reference_candidates && plan.reference_candidates.length > 0) {
    const refName = plan.reference_candidates[0].toLowerCase();
    selectedCandidate = allCandidates.find(c => 
      c.fullName.toLowerCase().includes(refName) || 
      c.email.toLowerCase().includes(refName)
    );
  }

  // Check for index references: "#2", "second", "2nd", "candidate 2"
  if (!selectedCandidate) {
    const indexPatterns = [
      /(?:candidate\s*)?#(\d+)/i,
      /(?:the\s+)?(\d+)(?:st|nd|rd|th)\s+(?:one|candidate)?/i,
      /(?:number\s+)?(\d+)/i
    ];
    
    for (const pattern of indexPatterns) {
      const match = messageLower.match(pattern);
      if (match) {
        const index = parseInt(match[1], 10);
        selectedCandidate = allCandidates.find(c => c.index === index);
        if (selectedCandidate) break;
      }
    }

    // Check for ordinal words: "first", "second", "third", "last"
    if (!selectedCandidate) {
      if (messageLower.includes('first') || messageLower.includes('1st')) {
        selectedCandidate = allCandidates.find(c => c.index === 1);
      } else if (messageLower.includes('second') || messageLower.includes('2nd')) {
        selectedCandidate = allCandidates.find(c => c.index === 2);
      } else if (messageLower.includes('third') || messageLower.includes('3rd')) {
        selectedCandidate = allCandidates.find(c => c.index === 3);
      } else if (messageLower.includes('last')) {
        selectedCandidate = allCandidates[allCandidates.length - 1];
      }
    }
  }

  // Check for name mentions in the question
  if (!selectedCandidate) {
    for (const candidate of allCandidates) {
      const firstName = candidate.fullName.split(' ')[0].toLowerCase();
      const lastName = candidate.fullName.split(' ').slice(-1)[0].toLowerCase();
      
      if (messageLower.includes(firstName) || 
          messageLower.includes(lastName) ||
          messageLower.includes(candidate.fullName.toLowerCase())) {
        selectedCandidate = candidate;
        break;
      }
    }
  }

  // Default to first candidate for pronouns like "she/he/they"
  if (!selectedCandidate) {
    selectedCandidate = allCandidates[0];
  }

  const email = selectedCandidate.email;

  // Fetch candidate data from database
  const orgRes = await sql`SELECT id::uuid as id FROM organizations WHERE slug = ${orgSlug} LIMIT 1`;
  if (!orgRes.rows.length) throw new Error('Org not found');
  const orgId = orgRes.rows[0].id;

  const candidateRes = await sql`
    SELECT 
      c.id,
      c.full_name as "fullName",
      c.email,
      c.field_of_study as "fieldOfStudy",
      c.area_of_interest as "areaOfInterest",
      c.gpa,
      c.degree,
      a.extracted_text as cv_text
    FROM candidates c
    LEFT JOIN cv_analysis a ON a.candidate_id = c.id
    WHERE c.org_id = ${orgId}::uuid
      AND (c.email ILIKE ${`%${email}%`} OR c.full_name ILIKE ${`%${email}%`})
      AND c.deleted_at IS NULL
    LIMIT 1
  `;

  if (!candidateRes.rows.length) {
    throw new Error('Candidate not found');
  }

  const candidate = candidateRes.rows[0];

  // Use GPT to analyze and answer the question
  if (process.env.OPENAI_API_KEY) {
    try {
      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const analysisPrompt = `You are analyzing a candidate for a recruiter.

**Candidate Profile:**
- Name: ${candidate.fullName}
- Email: ${candidate.email}
- Field of Study: ${candidate.fieldOfStudy || 'Not specified'}
- Area of Interest: ${candidate.areaOfInterest || 'Not specified'}
- GPA: ${candidate.gpa ? candidate.gpa.toFixed(2) : 'Not available'}
- Degree: ${candidate.degree || 'Not specified'}

**CV Content:**
${candidate.cv_text ? candidate.cv_text.substring(0, 3000) : 'CV text not available'}

**Question:**
${plan.analysis_query || message}

Provide a thoughtful, concise analysis based on the candidate's CV and profile. Be honest about strengths and potential concerns. Keep your response under 200 words.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: analysisPrompt }],
        temperature: 0.7,
        max_tokens: 400
      });

      const analysis = completion.choices?.[0]?.message?.content || 'Unable to generate analysis.';

      // Add context if analyzing non-first candidate
      const selectionNote = selectedCandidate.index > 1 
        ? `\n\n_Analyzing candidate #${selectedCandidate.index} from previous results._`
        : '';

      return {
        isAnalysis: true,
        candidateName: candidate.fullName,
        candidateEmail: candidate.email,
        candidateIndex: selectedCandidate.index,
        explanation: analysis + selectionNote,
        results: [] // No search results for analysis
      };
    } catch (err: any) {
      console.error('[ANALYSIS] OpenAI failed:', err?.message);
      throw err;
    }
  }

  // Fallback if OpenAI not available
  return {
    isAnalysis: true,
    candidateName: candidate.fullName,
    candidateEmail: candidate.email,
    explanation: `Analysis for ${candidate.fullName}: ${candidate.fieldOfStudy || 'Field not specified'}, GPA: ${candidate.gpa ? candidate.gpa.toFixed(2) : 'N/A'}. OpenAI is not configured for detailed analysis.`,
    results: []
  };
}

// Helper to call OpenAI with conversation history
async function callAIModel(message: string, conversationHistory: Array<{role: string, content: string}> = []): Promise<AIPlan> {
  const systemPrompt = `You are the Wathefni AI Admin Recruiting Agent - a helpful, conversational assistant for finding candidates.

Your capabilities:
- Understand natural recruiting queries and follow-ups ("show me more", "exclude that one", "find similar")
- Remember conversation context from previous messages
- Search candidates by skills, experience, education, location, and CV content
- Rank candidates intelligently based on relevance

Candidate data available:
- Basic: fullName, email, phone, location, fieldOfStudy, areaOfInterest
- Academic: gpa (0-4), degree, graduationYear
- Experience: work history, internships, projects
- Skills: technical, soft skills, languages
- CV: full text content (searchable semantically)
- Awards, certificates, achievements

Conversational patterns you understand:
- "Find X" / "Show me Y" → intent: rank_candidates
- "More results" / "Next 10" → intent: rank_candidates (increase limit, remember context)
- "Exclude [name]" → intent: rank_candidates (add exclusion filter)
- "Similar to [name]" → intent: rank_candidates (semantic similarity search)
- "Is [name] talented?" / "Tell me about X" / "Evaluate Y" → intent: analyze
- Ambiguous query → intent: clarify, needs_clarification: true

**NEW: Analysis Intent**
When user asks follow-up questions about specific candidates ("is she talented?", "tell me more about her", "what makes him qualified?"):
- Set intent: "analyze"
- Extract reference_candidates: [names or IDs mentioned or implied from recent results]
- Set analysis_query: the question to answer (e.g., "Is this candidate talented?")
- Leave filters empty
- Use conversation history to identify which candidate(s) they're asking about

IMPORTANT:
- ALWAYS return valid JSON matching the schema
- If you're unsure, return a working query with rank_candidates intent
- Use conversational context from history to refine searches
- For analysis questions, identify candidates from previous results
- Be helpful and natural in rationale field`;

  const userPrompt = `Current query: "${message}"

Context:
- Location: Kuwait (default if not specified)
- Common abbreviations: CS = Computer Science, SE = Software Engineering
- Previous conversation context is provided in message history

Return ONLY valid JSON matching this exact structure:
{
  "intent": "rank_candidates" | "filter" | "clarify",
  "filters": {
    "fieldOfStudy": "string or null",
    "areaOfInterest": "string or null",
    "mustHaveSkills": ["skill1", "skill2"] or null,
    "minGpa": number or null,
    "minYearsExperience": number or null
  },
  "rank_by": ["skills_match"],
  "limit": 20,
  "needs_clarification": false,
  "rationale": "Brief explanation of search strategy"
}

No markdown, no extra text, just pure JSON.`;

  // Use OpenAI if available, otherwise use fallback
  if (process.env.OPENAI_API_KEY) {
    try {
      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      // Build messages with conversation history
      const messages: Array<{role: 'system' | 'user' | 'assistant', content: string}> = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.slice(-6) as any, // Last 3 exchanges (6 messages)
        { role: 'user', content: userPrompt }
      ];

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: 'json_object' }
      });

      const content = completion.choices?.[0]?.message?.content;
      if (content) {
        let parsed: any;
        try {
          parsed = JSON.parse(content);
          // Use partial parsing to be more forgiving
          const validated = AIPlanSchema.parse(parsed);
          return validated;
        } catch (zodError: any) {
          console.error('Zod validation failed, using defaults:', zodError?.message);
          // If validation fails, try to salvage what we can with defaults
          const partial = {
            intent: parsed?.intent || 'rank_candidates',
            filters: parsed?.filters || {},
            rank_by: parsed?.rank_by || ['skills_match'],
            limit: parsed?.limit || 20,
            needs_clarification: parsed?.needs_clarification || false,
            clarify_question: parsed?.clarify_question || null,
            rationale: parsed?.rationale || 'Searching based on your query'
          };
          return AIPlanSchema.parse(partial);
        }
      }
    } catch (error: any) {
      console.error('OpenAI call failed:', error?.message);
      // Fall through to fallback
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
async function queryDatabase(plan: AIPlan, adminMessage: string, orgSlug: string) {
  try {
    // Build WHERE clauses (candidates schema)
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    // Always scope to organization first using join on organizations
    conditions.push(`o.slug = $${paramIndex}`);
    params.push(orgSlug);
    paramIndex++;

    if (plan.filters.fieldOfStudy) {
      conditions.push(`c.field_of_study ILIKE $${paramIndex}`);
      params.push(`%${plan.filters.fieldOfStudy}%`);
      paramIndex++;
    }

    if (plan.filters.areaOfInterest) {
      conditions.push(`c.area_of_interest ILIKE $${paramIndex}`);
      params.push(`%${plan.filters.areaOfInterest}%`);
      paramIndex++;
    }

    if (plan.filters.cvType && plan.filters.cvType !== 'both') {
      conditions.push(`c.cv_type::text = $${paramIndex}`);
      params.push(plan.filters.cvType === 'generated' ? 'ai_generated' : plan.filters.cvType);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Safety: clamp limit to prevent resource exhaustion
    const clampedLimit = Math.min(Math.max(plan.limit || 20, 10), 50);
    
    // Generate embedding for the query with caching (semantic similarity)
    const queryEmbedding = await generateQueryEmbedding(adminMessage || '', 10);
    const useEmbeddings = !!queryEmbedding;
    
    let rows: any[] = [];
    try {
      if (useEmbeddings && queryEmbedding) {
        console.log('[AGENT] Using pgvector semantic search');
        // Use pgvector for fast semantic search (precomputed embeddings)
        const vectorString = `[${queryEmbedding.embedding.join(',')}]`;
        const vectorQuery = `
          SELECT 
            c.id,
            c.full_name as "fullName",
            c.email,
            c.phone,
            c.field_of_study as "fieldOfStudy",
            c.area_of_interest as "areaOfInterest",
            c.created_at as submitted_at,
            a.extracted_text as parsed_text,
            c.gpa as gpa,
            c.cv_blob_key as cv_blob_key,
            c.parse_status::text as cv_parse_status,
            (e.embedding <=> $${paramIndex}::vector) as vector_distance
          FROM candidates c
          JOIN organizations o ON o.id = c.org_id
          LEFT JOIN cv_analysis a ON a.candidate_id = c.id AND a.org_id = c.org_id
          LEFT JOIN candidate_embeddings e ON e.candidate_id = c.id AND e.org_id = c.org_id
          ${whereClause}${whereClause ? ' AND' : 'WHERE'} e.embedding IS NOT NULL
          ORDER BY e.embedding <=> $${paramIndex}::vector
          LIMIT ${clampedLimit}
        `;
        params.push(vectorString);
        const vres = await sql.query(vectorQuery, params);
        rows = vres.rows as any[];
      } else {
        console.log('[AGENT] Using lexical search (no embeddings available)');
        // Fallback: basic lexical search
        const baseQuery = `
          SELECT 
            c.id,
            c.full_name as "fullName",
            c.email,
            c.phone,
            c.field_of_study as "fieldOfStudy",
            c.area_of_interest as "areaOfInterest",
            c.created_at as submitted_at,
            a.extracted_text as parsed_text,
            c.gpa as gpa,
            c.cv_blob_key as cv_blob_key,
            c.parse_status::text as cv_parse_status
          FROM candidates c
          JOIN organizations o ON o.id = c.org_id
          LEFT JOIN cv_analysis a ON a.candidate_id = c.id AND a.org_id = c.org_id
          ${whereClause}
          ORDER BY c.created_at DESC
          LIMIT ${clampedLimit}
        `;
        const vres = await sql.query(baseQuery, params);
        rows = vres.rows as any[];
      }

    // Score with lexical signals (mustHaveSkills + query terms)
    const queryTerms = (plan.filters.mustHaveSkills || [])
      .map(s => String(s).toLowerCase())
      .filter(Boolean);
    const adminTerms = String(adminMessage || '')
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/)
      .filter(Boolean);

    const ranked = rows.map((r) => {
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
        
        // TODO: Use OpenAI embeddings for true semantic similarity
        // For now: word boundaries + basic normalization (better than hardcoded synonyms)
        // Future: cosine similarity between query embedding and CV text embedding
        // This would automatically understand "Figma" ≈ "Sketch", "UI" ≈ "frontend designer", etc.
        
        const textLower = (r.parsed_text || '').toLowerCase();
        let termHits = 0;
        
        // Basic normalization for common variants (no semantic understanding yet)
        const normalizeSkill = (skill: string): string[] => {
          const s = skill.toLowerCase().trim();
          const variants = [s];
          
          // Handle common punctuation/spacing variants only
          if (s.includes('-')) variants.push(s.replace(/-/g, ' '), s.replace(/-/g, ''));
          if (s.includes(' ')) variants.push(s.replace(/\s+/g, '-'), s.replace(/\s+/g, ''));
          
          // Handle .js/.py extensions
          if (s.endsWith('.js')) variants.push(s.replace('.js', ''), s + 'script');
          if (s.endsWith('.py')) variants.push(s.replace('.py', ''));
          
          return [...new Set(variants)]; // dedupe
        };
        
        // Unicode-aware word boundary check (supports Arabic, Chinese, etc.)
        const createUnicodeWordBoundaryRegex = (term: string): RegExp => {
          // Escape special regex characters
          const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          // Use Unicode property escapes for proper word boundaries
          // \p{L} = any letter, \p{N} = any number
          return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, 'iu');
        };
        
        // Check must-have skills with Unicode-aware word boundaries
        queryTerms.forEach(t => { 
          if (!t) return;
          const variants = normalizeSkill(t);
          
          for (const variant of variants) {
            const regex = createUnicodeWordBoundaryRegex(variant);
            if (regex.test(textLower)) {
              termHits += 2; // Must-have skills count double
              break; // Only count once per skill
            }
          }
        });
        
        // Add lighter weight for general admin terms (with Unicode boundaries)
        adminTerms.forEach(t => { 
          if (t.length > 3) {
            const variants = normalizeSkill(t);
            for (const variant of variants) {
              const regex = createUnicodeWordBoundaryRegex(variant);
              if (regex.test(textLower)) {
                termHits += 0.3;
                break;
              }
            }
          }
        });

        // Better normalization: sqrt to prevent over-rewarding keyword stuffing
        const maxExpectedHits = Math.max(queryTerms.length * 2, 5);
        const lexicalScore = Math.min(Math.sqrt(termHits / maxExpectedHits), 1);

        // Semantic similarity using pgvector (precomputed embeddings)
        // This automatically understands: "Figma" ≈ "Sketch", "UI" ≈ "frontend", etc.
        let semanticScore = 0;
        if (useEmbeddings && r.vector_distance != null) {
          // Convert pgvector cosine distance to similarity score
          // Distance range: [0, 2] where 0 = identical, 2 = opposite
          // Convert to similarity: [0, 1] where 1 = identical, 0 = opposite
          const distance = Number(r.vector_distance);
          semanticScore = Math.max(0, 1 - (distance / 2));
        }

        // Hybrid score: combine lexical + semantic (if available)
        // If embeddings available: 60% semantic + 40% lexical
        // If not: 100% lexical (backward compatible)
        const simScore = useEmbeddings 
          ? (0.6 * semanticScore + 0.4 * lexicalScore)
          : lexicalScore;

        // Recency boost: newer submissions more heavily favored
        const monthsAgo = (Date.now() - new Date(r.submitted_at).getTime()) / (1000 * 60 * 60 * 24 * 30);
        const recencyScore = Math.max(0, 1 - (monthsAgo / 12)); // decay over 12 months (faster decay)

        // Rebalanced weights: prioritize skills match, less emphasis on GPA
        // sim: 65% - skills/keyword matching is most important
        // meta: 15% - field/area matching
        // recency: 12% - prefer recent applicants
        // gpa: 8% - nice to have but not critical for most roles
        const weights = { sim: 0.65, meta: 0.15, recency: 0.12, gpa: 0.08 };
        const finalScore = (
          weights.sim * simScore +
          weights.meta * Math.min(metaScore, 1) +
          weights.recency * recencyScore +
          weights.gpa * gpaScoreRaw
        );
        
        // Extract real project highlights from parsed CV text
        const projectHighlights: string[] = [];
        const matchedSkills: string[] = [];
        
        if (r.parsed_text) {
          const cvText = r.parsed_text.toLowerCase();
          const sentences = r.parsed_text.split(/[.!?]+/).filter((s: string) => s.trim().length > 10);
          
          // Find matched skills from the query (with Unicode-aware boundaries)
          if (plan.filters.mustHaveSkills) {
            plan.filters.mustHaveSkills.forEach(skill => {
              const variants = normalizeSkill(skill);
              
              for (const variant of variants) {
                const regex = createUnicodeWordBoundaryRegex(variant);
                if (regex.test(cvText)) {
                  matchedSkills.push(skill);
                  break; // Only add once per skill
                }
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
        if (useEmbeddings && semanticScore > 0.7) {
          reasons.push(`High semantic match (${Math.round(semanticScore * 100)}%)`);
        }
        matchedSkills.slice(0, 2).forEach(s => reasons.push(`Matched "${s}"`));
        if (fieldBoost && r.fieldOfStudy) reasons.push(`Boost: Field ${r.fieldOfStudy}`);
        if (areaBoost && r.areaOfInterest) reasons.push(`Boost: Area ${r.areaOfInterest}`);
        if (gpaReason) reasons.push(gpaReason);
        if (recencyScore > 0.7) reasons.push('Recent submission');

        // Use direct blob URL for downloads (avoids redirect issues)
        const blobKey = r.cv_blob_key || null;
        const isDirectUrl = blobKey && /^https?:\/\//i.test(blobKey);
        const downloadUrl = isDirectUrl ? blobKey : (blobKey ? `/api/${orgSlug}/admin/cv/original/${r.id}` : null);
        
        return {
          id: r.id,
          fullName: r.fullName,
          email: r.email,
          phone: (r as any).phone || null,
          fieldOfStudy: fieldLabel || null,
          areaOfInterest: r.areaOfInterest || null,
          gpa: hasGpa ? Number(Number(gpaVal).toFixed(2)) : null,
          cvUrl: downloadUrl,
          score: Math.round(finalScore * 100),
          parseStatus: (r as any).cv_parse_status || null,
          why: reasons.slice(0, 3),
          highlights: projectHighlights.slice(0, 3),
          download: downloadUrl,
          // legacy fields for panel compatibility
          experienceCount,
          projectHighlights: projectHighlights.slice(0, 4),
          matchedSkills,
          whyPicked: reasons.slice(0, 3).join(' | '),
          awards: [],
          cv_url_pdf: downloadUrl,  // Use PDF field for direct download
          cv_url_html: null
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
      // Fallback: basic metadata + optional parsed text from cv_analysis
      const query = `
        SELECT 
          c.id,
          c.full_name as "fullName",
          c.email,
          c.field_of_study as "fieldOfStudy",
          c.area_of_interest as "areaOfInterest",
          c.created_at as submitted_at,
          a.extracted_text as parsed_text,
          c.gpa as gpa
        FROM candidates c
        JOIN organizations o ON o.id = c.org_id
        LEFT JOIN cv_analysis a ON a.candidate_id = c.id AND a.org_id = c.org_id
        ${whereClause}
        ORDER BY c.created_at DESC
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
  const startTime = Date.now() // Track query performance
  
  // AuthZ: allow either a valid admin key OR a valid per-org admin JWT cookie
  const provided = (request.headers.get('x-admin-key') || '').trim();
  const envKey = (process.env.ADMIN_KEY || '').trim();
  const fallback = process.env.NODE_ENV !== 'production' ? 'test-admin-key' : '';
  const allowedKeys = [envKey, fallback].filter(Boolean);

  const orgSlugFromQuery = request.nextUrl.searchParams.get('org')?.trim() || ''

  let authorized = false;
  // Path 1: Admin key header (if configured)
  if (provided && allowedKeys.length && allowedKeys.includes(provided)) {
    authorized = true;
  }
  // Path 2: JWT cookie from per-org email/password login
  if (!authorized) {
    try {
      const token = request.cookies.get('admin_session')?.value || ''
      if (token) {
        const secret = new TextEncoder().encode(process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production')
        const { payload } = await jwtVerify(token, secret)
        const tokenOrgSlug = String((payload as any)?.orgSlug || '')
        // Enforce org match to maintain tenant isolation
        if (orgSlugFromQuery && tokenOrgSlug && tokenOrgSlug === orgSlugFromQuery) {
          authorized = true
        }
      }
    } catch {}
  }
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
    const { message, history } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Org guard (critical for multi-tenancy)
    const orgSlug = request.nextUrl.searchParams.get('org')?.trim() || ''
    if (!orgSlug) {
      return NextResponse.json({ error: 'Missing org' }, { status: 400 })
    }

    // Parse conversation history (optional)
    const conversationHistory = Array.isArray(history) ? history : [];

    // Get AI plan with conversation context
    const plan = await callAIModel(message, conversationHistory);

    // Handle clarification needed
    if (plan.needs_clarification) {
      return NextResponse.json({
        needsClarification: true,
        clarifyQuestion: plan.clarify_question,
        explanation: plan.rationale,
        filtersApplied: plan.filters
      });
    }

    // Handle analysis intent (follow-up questions about specific candidates)
    if (plan.intent === 'analyze') {
      try {
        const analysisResponse = await handleAnalysisQuery(
          plan, 
          message, 
          conversationHistory, 
          orgSlug
        );
        return NextResponse.json(analysisResponse);
      } catch (err: any) {
        console.error('[AGENT] Analysis failed:', err?.message);
        // Fallback to search if analysis fails
      }
    }

    // Query database using embeddings + metadata
    const results = await queryDatabase(plan, message, orgSlug);
    
    // Calculate performance metrics
    const queryTime = Date.now() - startTime
    const avgScore = results.length > 0 
      ? Math.round(results.reduce((sum: number, r: any) => sum + r.score, 0) / results.length)
      : 0

    // Log telemetry for monitoring
    console.log('[AGENT_TELEMETRY]', {
      queryTime,
      resultCount: results.length,
      avgScore,
      hasEmbeddings: !!plan.filters.mustHaveSkills?.length
    })

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
        needsClarification: false,
        _meta: { queryTime, avgScore }
      });
    }

    // Return results with complete structure
    return NextResponse.json({
      results,
      explanation: plan.rationale,
      filtersApplied: plan.filters,
      needsClarification: false,
      _meta: { queryTime, resultCount: results.length, avgScore }
    });

  } catch (error) {
    console.error('Agent query error:', error);
    return NextResponse.json({ 
      error: 'Failed to process query',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
