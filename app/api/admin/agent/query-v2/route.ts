import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { checkRateLimitWithConfig, createRateLimitResponse } from '@/lib/rateLimit';
import { jwtVerify } from '@/lib/esm-compat/jose';
import { generateQueryEmbedding } from '@/lib/embeddings';
import { searchMemories, saveContextMemory, getOrCreateSession, saveMessage, getRecentMessages } from '@/lib/conversation-memory';
import { recordPreference, getUserPreferences, recordHiringDecision, analyzeUserBehavior, getAdaptiveSearchSuggestions } from '@/lib/learning-engine';
import { extractPortfolioLinks, scrapeGitHub, scrapeBehance, analyzePortfolioWithAI, savePortfolioAnalysis, getCachedPortfolioAnalysis } from '@/lib/portfolio-analyzer';
import { sendEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Increase timeout for AI operations

// Helper: Wrap OpenAI calls with timeout protection
async function createCompletionWithTimeout(openai: any, params: any, timeoutMs = 25000) {
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('OpenAI request timeout')), timeoutMs)
  );
  
  return Promise.race([
    openai.chat.completions.create(params, { timeout: 20000 }),
    timeoutPromise
  ]);
}

// Tool definitions for OpenAI function calling
const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'search_candidates',
      description: 'Search the candidate database based on skills, experience, education, and other criteria. Use this when the user wants to find candidates.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Natural language search query (e.g., "React developers with 3+ years")'
          },
          skills: {
            type: 'array',
            items: { type: 'string' },
            description: 'Required skills (e.g., ["React", "TypeScript"])'
          },
          field_of_study: {
            type: 'string',
            description: 'Field of study (e.g., "Computer Science")'
          },
          min_gpa: {
            type: 'number',
            description: 'Minimum GPA (0-4 scale)'
          },
          limit: {
            type: 'number',
            description: 'Number of results to return (default 10)',
            default: 10
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'analyze_candidate',
      description: 'Get detailed analysis of a specific candidate including their full CV, skills, experience, and fit assessment. Use this when asked about a specific person.',
      parameters: {
        type: 'object',
        properties: {
          identifier: {
            type: 'string',
            description: 'Candidate name, email, or ID from previous search results'
          },
          focus: {
            type: 'string',
            description: 'What to focus on in the analysis (e.g., "leadership skills", "technical expertise", "cultural fit")'
          }
        },
        required: ['identifier']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'compare_candidates',
      description: 'Compare multiple candidates side-by-side for a specific role or criteria. Use this when asked to compare or decide between candidates.',
      parameters: {
        type: 'object',
        properties: {
          identifiers: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of candidate names, emails, or IDs to compare'
          },
          criteria: {
            type: 'string',
            description: 'What to compare them for (e.g., "frontend development role", "leadership potential")'
          }
        },
        required: ['identifiers', 'criteria']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'save_shortlist',
      description: 'Save a group of candidates to a named shortlist for later reference. Use this when the user wants to remember or organize candidates.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name for the shortlist (e.g., "Frontend Team Candidates", "Senior Developers")'
          },
          candidate_identifiers: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of candidate names, emails, or IDs to save'
          },
          description: {
            type: 'string',
            description: 'Optional description or notes about this shortlist'
          }
        },
        required: ['name', 'candidate_identifiers']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'email_candidate',
      description: 'Send an email to one or more candidates. Use for interview requests, follow-ups, or rejections. IMPORTANT: Use candidate NAMES from search results, not made-up email addresses.',
      parameters: {
        type: 'object',
        properties: {
          candidate_identifiers: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of candidate FULL NAMES (e.g., "Buthaina Alzoubi") or IDs from previous search results. DO NOT make up email addresses - use the exact name from search results.'
          },
          email_type: {
            type: 'string',
            enum: ['interview_request', 'follow_up', 'rejection', 'general'],
            description: 'Type of email being sent'
          },
          subject: {
            type: 'string',
            description: 'Email subject line'
          },
          message: {
            type: 'string',
            description: 'Email body content'
          }
        },
        required: ['candidate_identifiers', 'email_type', 'subject', 'message']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'export_results',
      description: 'Export search results or shortlist to PDF or CSV format. Use when the user wants to download or share candidate data.',
      parameters: {
        type: 'object',
        properties: {
          candidate_identifiers: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of candidate names, emails, or IDs to export'
          },
          format: {
            type: 'string',
            enum: ['pdf', 'csv'],
            description: 'Export format'
          },
          include_cv_text: {
            type: 'boolean',
            description: 'Whether to include full CV text in export',
            default: false
          }
        },
        required: ['candidate_identifiers', 'format']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'recall_memory',
      description: 'Search past conversations and decisions for relevant context. Use when the user asks about previous searches, candidates they liked, or past decisions.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'What to search for in memory (e.g., "React developers I liked", "why I rejected Ahmad")'
          },
          limit: {
            type: 'number',
            description: 'Number of memories to retrieve',
            default: 5
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'save_memory',
      description: 'Save an important insight, decision, or note about a candidate for future reference. Use when the user expresses preferences or makes decisions.',
      parameters: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'The insight or decision to remember'
          },
          memory_type: {
            type: 'string',
            enum: ['decision', 'note', 'preference', 'insight'],
            description: 'Type of memory'
          },
          candidate_names: {
            type: 'array',
            items: { type: 'string' },
            description: 'Related candidate names or emails (optional)'
          }
        },
        required: ['content', 'memory_type']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'learn_preference',
      description: 'Learn and remember a user preference for future searches. Use when the user expresses what they value or prefer in candidates.',
      parameters: {
        type: 'object',
        properties: {
          preference_type: {
            type: 'string',
            description: 'Type of preference (e.g., "min_gpa", "experience_level", "preferred_skills", "field_preference")'
          },
          preference_value: {
            type: 'string',
            description: 'The preference value'
          },
          reinforce: {
            type: 'boolean',
            description: 'Whether this reinforces an existing preference',
            default: false
          }
        },
        required: ['preference_type', 'preference_value']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_my_preferences',
      description: 'Get the user\'s learned preferences and hiring patterns. Use when asked about preferences or to provide personalized suggestions.',
      parameters: {
        type: 'object',
        properties: {
          include_patterns: {
            type: 'boolean',
            description: 'Include hiring patterns and recommendations',
            default: true
          }
        }
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'record_decision',
      description: 'Record a hiring decision (hired, rejected, interviewed, etc.) to learn from outcomes.',
      parameters: {
        type: 'object',
        properties: {
          candidate_name: {
            type: 'string',
            description: 'Name of the candidate'
          },
          decision: {
            type: 'string',
            enum: ['hired', 'rejected', 'interviewed', 'shortlisted', 'passed'],
            description: 'The hiring decision made'
          },
          reason: {
            type: 'string',
            description: 'Reason for the decision'
          }
        },
        required: ['candidate_name', 'decision', 'reason']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'review_portfolio',
      description: 'Analyze a candidate\'s online portfolio (GitHub, Behance, LinkedIn, etc.) for quality and fit assessment. Use when asked about portfolio quality or to enhance candidate evaluation.',
      parameters: {
        type: 'object',
        properties: {
          candidate_identifier: {
            type: 'string',
            description: 'Candidate name, email, or ID'
          },
          force_refresh: {
            type: 'boolean',
            description: 'Force re-scraping even if cached data exists',
            default: false
          }
        },
        required: ['candidate_identifier']
      }
    }
  }
];

// Execute search_candidates tool
async function executeSearch(args: any, orgSlug: string): Promise<any> {
  const { query, skills, field_of_study, min_gpa, limit = 50 } = args; // Increased default limit
  
  // Get org
  const orgRes = await sql`SELECT id::uuid as id FROM organizations WHERE slug = ${orgSlug} LIMIT 1`;
  if (!orgRes.rows.length) throw new Error('Organization not found');
  const orgId = orgRes.rows[0].id;

  // Build query conditions
  const conditions: string[] = [`c.org_id = $1`, `c.deleted_at IS NULL`];
  const params: any[] = [orgId];
  let paramIndex = 2;

  if (field_of_study) {
    conditions.push(`c.field_of_study ILIKE $${paramIndex}`);
    params.push(`%${field_of_study}%`);
    paramIndex++;
  }

  if (min_gpa) {
    conditions.push(`c.gpa >= $${paramIndex}`);
    params.push(min_gpa);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');

  // Hybrid search: Use embeddings for parsed CVs, fallback to field matching for unparsed
  const queryEmbedding = await generateQueryEmbedding(query, 10);
  
  let results = [];
  
  // APPROACH: UNION semantic search (parsed CVs) + basic field search (unparsed CVs)
  if (queryEmbedding) {
    const vectorString = `[${queryEmbedding.embedding.join(',')}]`;
    
    // Part 1: Semantic search for parsed CVs (WITH embeddings)
    const semanticQuery = `
      SELECT 
        c.id::text,
        c.full_name as "fullName",
        c.email,
        c.field_of_study as "fieldOfStudy",
        c.area_of_interest as "areaOfInterest",
        c.gpa,
        a.extracted_text,
        (e.embedding <=> $${paramIndex}::vector) as distance,
        'semantic' as search_type
      FROM candidates c
      LEFT JOIN cv_analysis a ON a.candidate_id = c.id
      LEFT JOIN candidate_embeddings e ON e.candidate_id = c.id
      WHERE ${whereClause} AND e.embedding IS NOT NULL
      ORDER BY e.embedding <=> $${paramIndex}::vector
      LIMIT ${Math.min(limit, 50)}
    `;
    params.push(vectorString);
    
    // Part 2: Basic field search for UNparsed CVs (WITHOUT embeddings)
    // Use field_of_study and area_of_interest columns from candidates table
    const fieldQuery = `
      SELECT 
        c.id::text,
        c.full_name as "fullName",
        c.email,
        c.field_of_study as "fieldOfStudy",
        c.area_of_interest as "areaOfInterest",
        c.gpa,
        a.extracted_text,
        999 as distance,
        'field_match' as search_type
      FROM candidates c
      LEFT JOIN cv_analysis a ON a.candidate_id = c.id
      LEFT JOIN candidate_embeddings e ON e.candidate_id = c.id
      WHERE ${whereClause} 
        AND e.embedding IS NULL
        AND (
          c.field_of_study ILIKE $${paramIndex + 1}
          OR c.area_of_interest ILIKE $${paramIndex + 1}
        )
      ORDER BY c.created_at DESC
      LIMIT ${Math.min(limit, 50)}
    `;
    params.push(`%${query}%`); // Use query text for ILIKE search
    
    // UNION both approaches
    const unionQuery = `
      (${semanticQuery})
      UNION ALL
      (${fieldQuery})
      ORDER BY distance
      LIMIT ${Math.min(limit, 50)}
    `;
    
    const res = await sql.query(unionQuery, params);
    results = res.rows;
  } else {
    // Fallback: basic search on all candidates
    const searchQuery = `
      SELECT 
        c.id::text,
        c.full_name as "fullName",
        c.email,
        c.field_of_study as "fieldOfStudy",
        c.area_of_interest as "areaOfInterest",
        c.gpa,
        a.extracted_text
      FROM candidates c
      LEFT JOIN cv_analysis a ON a.candidate_id = c.id
      WHERE ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT ${Math.min(limit, 50)}
    `;
    const res = await sql.query(searchQuery, params);
    results = res.rows;
  }

  // Calculate scores for ranking
  const candidatesWithScores = await Promise.all(results.map(async (r: any) => {
    let score = 0;
    try {
      // Call internal scoring API
      const scoreRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ai/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cv: {
            education: [{ gpa: r.gpa, fieldOfStudy: r.fieldOfStudy }],
            // We'd need to parse cv_json for full scoring, but use GPA as proxy for now
          }
        })
      });
      if (scoreRes.ok) {
        const scoreData = await scoreRes.json();
        score = scoreData.candidate_score || 0;
      }
    } catch (err) {
      // Fallback: simple GPA-based score
      score = r.gpa ? Math.round((Number(r.gpa) / 4.0) * 100) : 50;
    }
    
    return {
      index: 0, // Will be renumbered after sorting
      id: r.id,
      name: r.fullName,
      email: r.email,
      field: r.fieldOfStudy,
      area: r.areaOfInterest,
      gpa: r.gpa ? Number(r.gpa).toFixed(2) : null,
      score: score,
      cv_summary: r.extracted_text ? r.extracted_text.substring(0, 500) + '...' : 'No CV text'
    };
  }));

  // Sort by score (best to worst)
  candidatesWithScores.sort((a, b) => b.score - a.score);
  candidatesWithScores.forEach((c, idx) => c.index = idx + 1);

  // Format for GPT
  return {
    found: results.length,
    candidates: candidatesWithScores
  };
}

// Execute analyze_candidate tool
async function analyzeCandidate(args: any, orgSlug: string, conversationContext: any[]): Promise<any> {
  const { identifier, focus } = args;
  
  // Get org
  const orgRes = await sql`SELECT id::uuid as id FROM organizations WHERE slug = ${orgSlug} LIMIT 1`;
  if (!orgRes.rows.length) throw new Error('Organization not found');
  const orgId = orgRes.rows[0].id;

  // Find candidate (by name, email, or ID)
  const searchPattern = `%${identifier}%`;
  const res = await sql`
    SELECT 
      c.id::text,
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
      AND (
        c.full_name ILIKE ${searchPattern}
        OR c.email ILIKE ${searchPattern}
        OR c.id::text = ${identifier}
      )
      AND c.deleted_at IS NULL
    LIMIT 1
  `;

  if (!res.rows.length) {
    return { error: 'Candidate not found' };
  }

  const candidate = res.rows[0];
  
  return {
    name: candidate.fullName,
    email: candidate.email,
    field: candidate.fieldOfStudy,
    area: candidate.areaOfInterest,
    gpa: candidate.gpa ? Number(candidate.gpa).toFixed(2) : null,
    degree: candidate.degree,
    cv_text: candidate.cv_text || 'No CV text available',
    focus_area: focus || 'general fit'
  };
}

// Execute compare_candidates tool
async function compareCandidates(args: any, orgSlug: string): Promise<any> {
  const { identifiers, criteria } = args;
  
  // Get org
  const orgRes = await sql`SELECT id::uuid as id FROM organizations WHERE slug = ${orgSlug} LIMIT 1`;
  if (!orgRes.rows.length) throw new Error('Organization not found');
  const orgId = orgRes.rows[0].id;

  const candidates = [];
  
  for (const identifier of identifiers) {
    const searchPattern = `%${identifier}%`;
    const res = await sql`
      SELECT 
        c.id::text,
        c.full_name as "fullName",
        c.email,
        c.field_of_study as "fieldOfStudy",
        c.gpa,
        a.extracted_text as cv_text
      FROM candidates c
      LEFT JOIN cv_analysis a ON a.candidate_id = c.id
      WHERE c.org_id = ${orgId}::uuid
        AND (
          c.full_name ILIKE ${searchPattern}
          OR c.email ILIKE ${searchPattern}
          OR c.id::text = ${identifier}
        )
        AND c.deleted_at IS NULL
      LIMIT 1
    `;
    
    if (res.rows.length > 0) {
      const c = res.rows[0];
      candidates.push({
        name: c.fullName,
        email: c.email,
        field: c.fieldOfStudy,
        gpa: c.gpa ? Number(c.gpa).toFixed(2) : null,
        cv_summary: c.cv_text ? c.cv_text.substring(0, 1000) : 'No CV'
      });
    }
  }

  return {
    comparing: candidates.length,
    candidates,
    criteria
  };
}

// Execute save_shortlist tool
async function saveShortlist(args: any, orgSlug: string, adminEmail: string): Promise<any> {
  const { name, candidate_identifiers, description } = args;
  
  // Get org
  const orgRes = await sql`SELECT id::uuid as id FROM organizations WHERE slug = ${orgSlug} LIMIT 1`;
  if (!orgRes.rows.length) throw new Error('Organization not found');
  const orgId = orgRes.rows[0].id;

  // Create shortlist
  const shortlistRes = await sql`
    INSERT INTO shortlists (org_id, name, description, created_by)
    VALUES (${orgId}::uuid, ${name}, ${description || null}, ${adminEmail})
    RETURNING id::text
  `;
  const shortlistId = shortlistRes.rows[0].id;

  // Add candidates to shortlist
  const added = [];
  const notFound = [];

  for (const identifier of candidate_identifiers) {
    const searchPattern = `%${identifier}%`;
    const res = await sql`
      SELECT id::text, full_name, email
      FROM candidates
      WHERE org_id = ${orgId}::uuid
        AND (
          full_name ILIKE ${searchPattern}
          OR email ILIKE ${searchPattern}
          OR id::text = ${identifier}
        )
        AND deleted_at IS NULL
      LIMIT 1
    `;

    if (res.rows.length > 0) {
      const candidate = res.rows[0];
      await sql`
        INSERT INTO shortlist_members (shortlist_id, candidate_id)
        VALUES (${shortlistId}::uuid, ${candidate.id}::uuid)
        ON CONFLICT (shortlist_id, candidate_id) DO NOTHING
      `;
      added.push(candidate.full_name);
    } else {
      notFound.push(identifier);
    }
  }

  return {
    success: true,
    shortlist_name: name,
    added_count: added.length,
    added_candidates: added,
    not_found: notFound
  };
}

// Execute email_candidate tool
async function emailCandidate(args: any, orgSlug: string, adminEmail: string): Promise<any> {
  const { candidate_identifiers, email_type, subject, message } = args;
  
  // Get org
  const orgRes = await sql`SELECT id::uuid as id FROM organizations WHERE slug = ${orgSlug} LIMIT 1`;
  if (!orgRes.rows.length) throw new Error('Organization not found');
  const orgId = orgRes.rows[0].id;

  const emailed = [];
  const notFound = [];

  for (const identifier of candidate_identifiers) {
    // Clean identifier: remove @example.com artifacts and normalize
    const cleanId = identifier.replace(/@example\.com$/i, '').trim();
    const searchPattern = `%${cleanId}%`;
    
    const res = await sql`
      SELECT id::text, full_name, email
      FROM candidates
      WHERE org_id = ${orgId}::uuid
        AND (
          full_name ILIKE ${searchPattern}
          OR email ILIKE ${searchPattern}
          OR id::text = ${cleanId}
        )
        AND deleted_at IS NULL
      ORDER BY 
        CASE 
          WHEN full_name ILIKE ${cleanId} THEN 1
          WHEN email ILIKE ${cleanId} THEN 2
          ELSE 3
        END
      LIMIT 1
    `;

    if (res.rows.length > 0) {
      const candidate = res.rows[0];
      
      // Actually send the email via Resend
      let emailStatus = 'sent';
      let emailError = null;
      
      try {
        // Get organization details and inbox preferences
        const orgDetailsRes = await sql`
          SELECT name, slug, inbox_mode FROM organizations WHERE id = ${orgId}::uuid LIMIT 1
        `;
        const orgName = orgDetailsRes.rows[0]?.name || 'Hiring Team';
        const orgSlugFromDb = orgDetailsRes.rows[0]?.slug || orgSlug;
        const inboxMode = orgDetailsRes.rows[0]?.inbox_mode || 'both'; // Default: both
        
        // Determine Reply-To based on org preference
        // Auto per-org inbound: each org gets {orgSlug}@fresh-antlion.resend.app
        const inboundDomain = process.env.RESEND_INBOUND_DOMAIN || 'fresh-antlion.resend.app';
        const orgInboxEmail = `${orgSlugFromDb}@${inboundDomain}`;
        let replyToEmail: string;
        
        switch (inboxMode) {
          case 'inbox_only':
            // All replies go to org-specific inbox (captured by webhook)
            replyToEmail = orgInboxEmail;
            break;
          case 'personal_email':
            // Replies go to admin's personal email
            replyToEmail = adminEmail;
            break;
          case 'both':
          default:
            // Reply-To org inbox for tracking (best for STC demo)
            replyToEmail = orgInboxEmail;
            break;
        }
        
        const fromEmail = process.env.RESEND_FROM || 'hiring@wathefni.ai';
        const fromName = `${orgName} Hiring`;
        
        console.log('[AI_AGENT_EMAIL] Attempting to send to:', candidate.email);
        console.log('[AI_AGENT_EMAIL] Reply-To:', replyToEmail);
        console.log('[AI_AGENT_EMAIL] Inbox mode:', inboxMode);
        
        await sendEmail({
          to: candidate.email,
          subject: subject,
          html: `
            ${message}
            <br><br>
            <p style="color: #666; font-size: 12px; border-top: 1px solid #eee; padding-top: 10px; margin-top: 20px;">
              Sent by ${adminEmail} from ${orgName}
              <br>
              Reply to this email to contact the recruiter directly.
            </p>
          `,
          from: `${fromName} <${fromEmail}>`,
          replyTo: replyToEmail
        });
        console.log('[AI_AGENT_EMAIL] ✅ Email sent successfully to:', candidate.email);
      } catch (error: any) {
        console.error('[AI_AGENT_EMAIL] ❌ Failed to send:', error);
        console.error('[AI_AGENT_EMAIL] Error details:', JSON.stringify(error, null, 2));
        emailStatus = 'failed';
        emailError = error.message || String(error);
      }
      
      // Log the email to database (best effort - don't fail if table doesn't exist)
      try {
        await sql`
          INSERT INTO email_logs (
            org_id, candidate_id, recipient_email, subject, body,
            email_type, status, sent_by, metadata
          )
          VALUES (
            ${orgId}::uuid,
            ${candidate.id}::uuid,
            ${candidate.email},
            ${subject},
            ${message},
            ${email_type},
            ${emailStatus},
            ${adminEmail},
            ${JSON.stringify({ via: 'ai_agent', error: emailError })}::jsonb
          )
        `;
      } catch (logError: any) {
        console.warn('[AI_AGENT_EMAIL] Failed to log to email_logs table:', logError.message);
      }
      
      emailed.push({ 
        name: candidate.full_name, 
        email: candidate.email,
        status: emailStatus
      });
    } else {
      notFound.push(identifier);
    }
  }

  const successCount = emailed.filter(e => e.status === 'sent').length;
  const failedCount = emailed.filter(e => e.status === 'failed').length;

  return {
    success: true,
    email_type,
    emailed_count: emailed.length,
    sent_count: successCount,
    failed_count: failedCount,
    emailed_candidates: emailed,
    not_found: notFound,
    note: successCount > 0 ? `Successfully sent ${successCount} email(s) via Resend` : 'Email sending failed'
  };
}

// Execute export_results tool
async function exportResults(args: any, orgSlug: string): Promise<any> {
  const { candidate_identifiers, format, include_cv_text } = args;
  
  // Get org
  const orgRes = await sql`SELECT id::uuid as id FROM organizations WHERE slug = ${orgSlug} LIMIT 1`;
  if (!orgRes.rows.length) throw new Error('Organization not found');
  const orgId = orgRes.rows[0].id;

  const candidates = [];

  for (const identifier of candidate_identifiers) {
    const searchPattern = `%${identifier}%`;
    const res = await sql`
      SELECT 
        c.id::text,
        c.full_name,
        c.email,
        c.phone,
        c.field_of_study,
        c.area_of_interest,
        c.gpa,
        c.degree,
        a.extracted_text as cv_text
      FROM candidates c
      LEFT JOIN cv_analysis a ON a.candidate_id = c.id
      WHERE c.org_id = ${orgId}::uuid
        AND (
          c.full_name ILIKE ${searchPattern}
          OR c.email ILIKE ${searchPattern}
          OR c.id::text = ${identifier}
        )
        AND c.deleted_at IS NULL
      LIMIT 1
    `;

    if (res.rows.length > 0) {
      const c = res.rows[0];
      candidates.push({
        name: c.full_name,
        email: c.email,
        phone: c.phone,
        field: c.field_of_study,
        area: c.area_of_interest,
        gpa: c.gpa ? Number(c.gpa).toFixed(2) : null,
        degree: c.degree,
        cv_text: include_cv_text ? c.cv_text : undefined
      });
    }
  }

  // Generate export data
  if (format === 'csv') {
    const headers = ['Name', 'Email', 'Phone', 'Field', 'Area', 'GPA', 'Degree'];
    const rows = candidates.map(c => [
      c.name, c.email, c.phone, c.field, c.area, c.gpa, c.degree
    ]);
    
    return {
      success: true,
      format: 'csv',
      count: candidates.length,
      data: { headers, rows },
      note: 'CSV data ready. Download functionality requires frontend implementation.'
    };
  } else {
    // PDF would require PDF generation library
    return {
      success: true,
      format: 'pdf',
      count: candidates.length,
      candidates: candidates.map(c => ({
        name: c.name,
        email: c.email,
        field: c.field,
        gpa: c.gpa
      })),
      note: 'PDF generation requires additional library. Data prepared for export.'
    };
  }
}

// Execute recall_memory tool
async function recallMemory(args: any, orgSlug: string, adminEmail: string): Promise<any> {
  const { query, limit = 5 } = args;
  
  // Get org
  const orgRes = await sql`SELECT id::uuid as id FROM organizations WHERE slug = ${orgSlug} LIMIT 1`;
  if (!orgRes.rows.length) throw new Error('Organization not found');
  const orgId = orgRes.rows[0].id;

  // Search memories
  const memories = await searchMemories(orgId, adminEmail, query, limit);

  if (memories.length === 0) {
    return {
      found: 0,
      memories: [],
      note: 'No relevant past conversations found.'
    };
  }

  return {
    found: memories.length,
    memories: memories.map(m => ({
      type: m.memory_type,
      content: m.content,
      candidates: m.related_candidates,
      when: m.created_at
    }))
  };
}

// Execute save_memory tool
async function saveMemory(args: any, orgSlug: string, adminEmail: string, sessionId: string): Promise<any> {
  const { content, memory_type, candidate_names = [] } = args;
  
  // Get org
  const orgRes = await sql`SELECT id::uuid as id FROM organizations WHERE slug = ${orgSlug} LIMIT 1`;
  if (!orgRes.rows.length) throw new Error('Organization not found');
  const orgId = orgRes.rows[0].id;

  // Save memory
  await saveContextMemory(
    orgId,
    adminEmail,
    sessionId,
    memory_type,
    content,
    candidate_names
  );

  return {
    success: true,
    saved: content,
    type: memory_type,
    note: 'Memory saved for future reference'
  };
}

// Execute learn_preference tool
async function learnPreference(args: any, orgSlug: string, adminEmail: string): Promise<any> {
  const { preference_type, preference_value, reinforce = false } = args;
  
  // Get org
  const orgRes = await sql`SELECT id::uuid as id FROM organizations WHERE slug = ${orgSlug} LIMIT 1`;
  if (!orgRes.rows.length) throw new Error('Organization not found');
  const orgId = orgRes.rows[0].id;

  // Record preference
  await recordPreference(orgId, adminEmail, preference_type, preference_value, reinforce);

  return {
    success: true,
    learned: `${preference_type}: ${preference_value}`,
    note: reinforce ? 'Preference reinforced' : 'New preference learned'
  };
}

// Execute get_my_preferences tool
async function getMyPreferences(args: any, orgSlug: string, adminEmail: string): Promise<any> {
  const { include_patterns = true } = args;
  
  // Get org
  const orgRes = await sql`SELECT id::uuid as id FROM organizations WHERE slug = ${orgSlug} LIMIT 1`;
  if (!orgRes.rows.length) throw new Error('Organization not found');
  const orgId = orgRes.rows[0].id;

  // Get preferences
  const prefs = await getUserPreferences(orgId, adminEmail, 0.5);

  if (!include_patterns) {
    return {
      preferences: prefs.map(p => ({
        type: p.preference_key,
        value: p.preference_value,
        confidence: Math.round(p.confidence_score * 100)
      }))
    };
  }

  // Get full analysis
  const analysis = await analyzeUserBehavior(orgId, adminEmail);

  return {
    preferences: prefs.map(p => ({
      type: p.preference_key,
      value: p.preference_value,
      confidence: Math.round(p.confidence_score * 100),
      evidence: p.evidence_count
    })),
    patterns: analysis.patterns,
    recommendations: analysis.recommendations
  };
}

// Execute record_decision tool
async function recordDecision(args: any, orgSlug: string, adminEmail: string, sessionId: string): Promise<any> {
  const { candidate_name, decision, reason } = args;
  
  // Get org
  const orgRes = await sql`SELECT id::uuid as id FROM organizations WHERE slug = ${orgSlug} LIMIT 1`;
  if (!orgRes.rows.length) throw new Error('Organization not found');
  const orgId = orgRes.rows[0].id;

  // Record decision
  await recordHiringDecision(
    orgId,
    adminEmail,
    null, // candidate_id (would need to look up)
    candidate_name,
    decision,
    reason,
    {},
    sessionId
  );

  return {
    success: true,
    recorded: `${decision} - ${candidate_name}`,
    reason: reason,
    note: 'Decision recorded for learning'
  };
}

// Execute review_portfolio tool
async function reviewPortfolio(args: any, orgSlug: string): Promise<any> {
  const { candidate_identifier, force_refresh = false } = args;
  
  // Get org
  const orgRes = await sql`SELECT id::uuid as id FROM organizations WHERE slug = ${orgSlug} LIMIT 1`;
  if (!orgRes.rows.length) throw new Error('Organization not found');
  const orgId = orgRes.rows[0].id;

  // Find candidate
  const searchPattern = `%${candidate_identifier}%`;
  const candidateRes = await sql`
    SELECT 
      c.id::text,
      c.full_name,
      c.email,
      c.github_url,
      c.behance_url,
      c.dribbble_url,
      c.linkedin_url,
      c.portfolio_url,
      a.extracted_text as cv_text
    FROM candidates c
    LEFT JOIN cv_analysis a ON a.candidate_id = c.id
    WHERE c.org_id = ${orgId}::uuid
      AND (
        c.full_name ILIKE ${searchPattern}
        OR c.email ILIKE ${searchPattern}
        OR c.id::text = ${candidate_identifier}
      )
      AND c.deleted_at IS NULL
    LIMIT 1
  `;

  if (!candidateRes.rows.length) {
    return { error: 'Candidate not found' };
  }

  const candidate = candidateRes.rows[0];

  // Check for cached analysis
  if (!force_refresh) {
    const cached = await getCachedPortfolioAnalysis(candidate.id);
    if (cached) {
      return {
        candidate_name: candidate.full_name,
        cached: true,
        quality_score: cached.overall_quality_score,
        quality_rating: cached.quality_rating,
        strengths: cached.strengths,
        concerns: cached.concerns,
        github: cached.github_repos ? {
          repos: cached.github_repos,
          stars: cached.github_stars
        } : null,
        behance: cached.behance_projects ? {
          projects: cached.behance_projects,
          views: cached.behance_views
        } : null,
        recommendation: cached.ai_recommendation
      };
    }
  }

  // Extract portfolio links
  const links = extractPortfolioLinks(candidate);

  if (!links.github && !links.behance && !links.dribbble && !links.website) {
    return {
      candidate_name: candidate.full_name,
      error: 'No portfolio links found in candidate profile'
    };
  }

  // Scrape portfolios
  const portfolioData: any = {};

  if (links.github) {
    portfolioData.github = await scrapeGitHub(links.github);
    portfolioData.github.url = links.github;
  }

  if (links.behance) {
    portfolioData.behance = await scrapeBehance(links.behance);
    portfolioData.behance.url = links.behance;
  }

  // Analyze with AI
  const analysis = await analyzePortfolioWithAI(
    candidate.full_name,
    portfolioData,
    candidate.cv_text
  );

  // Save to database
  await savePortfolioAnalysis(candidate.id, orgId, portfolioData, analysis);

  return {
    candidate_name: candidate.full_name,
    quality_score: analysis.overall_quality_score,
    quality_rating: analysis.quality_rating,
    strengths: analysis.strengths,
    concerns: analysis.concerns,
    github: portfolioData.github || null,
    behance: portfolioData.behance || null,
    recommendation: analysis.ai_recommendation
  };
}

// Main conversation handler with function calling
async function handleConversation(
  userMessage: string,
  conversationHistory: any[],
  orgSlug: string,
  adminEmail: string = 'ai-agent@system'
): Promise<any> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const { default: OpenAI } = await import('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Get org ID for session management
  const orgRes = await sql`SELECT id::uuid as id FROM organizations WHERE slug = ${orgSlug} LIMIT 1`;
  if (!orgRes.rows.length) throw new Error('Organization not found');
  const orgId = orgRes.rows[0].id;

  // Get or create conversation session
  const sessionId = await getOrCreateSession(orgId, adminEmail);

  // Load recent conversation history from database
  const dbHistory = await getRecentMessages(sessionId, 10);
  const dbMessages = dbHistory.map(msg => ({
    role: msg.role,
    content: msg.message
  }));

  // Save user message to history
  await saveMessage(sessionId, orgId, adminEmail, 'user', userMessage);

  // Build messages with full conversation context (DB history + current frontend history)
  const messages: any[] = [
    {
      role: 'system',
      content: `You are an expert recruiting assistant with access to a candidate database. 

Your personality:
- Professional but conversational and friendly
- Ask clarifying questions when needed
- Provide honest assessments (strengths AND concerns)
- Make specific recommendations with reasoning

You have access to these tools:
1. search_candidates - Find candidates by skills, field, GPA, etc.
2. analyze_candidate - Get detailed analysis of a specific person
3. compare_candidates - Compare multiple candidates side-by-side
4. save_shortlist - Save candidates to named lists (e.g., "Frontend Team")
5. email_candidate - Send interview requests or follow-up emails
6. export_results - Export candidates to PDF or CSV
7. recall_memory - Search past conversations and decisions
8. save_memory - Remember important insights or preferences
9. learn_preference - Learn what the user values (GPA, experience, skills, etc.)
10. get_my_preferences - Check what preferences you've learned
11. record_decision - Track hiring decisions (hired, rejected, etc.)
12. review_portfolio - Analyze GitHub/Behance/LinkedIn portfolios for quality

Portfolio Review:
- PROACTIVELY offer to review portfolios when evaluating candidates
- Use review_portfolio to analyze GitHub, Behance, Dribbble, LinkedIn
- Provide quality scores, strengths, concerns, and recommendations
- Compare portfolio quality across candidates
- Example: "Sarah has 500 GitHub stars and strong React projects"

Learning & Personalization:
- PROACTIVELY learn from user behavior and preferences
- When users express what they value, use learn_preference immediately
- When they make hiring decisions, use record_decision to learn patterns
- Before searching, check get_my_preferences to apply learned filters
- Adapt your suggestions based on past behavior
- Example: If user always prefers high GPA, suggest filtering by GPA automatically

Memory capabilities:
- You can remember past conversations and decisions
- When users mention preferences or make decisions, proactively save them
- When asked about past searches or candidates, use recall_memory
- Reference past context naturally (e.g., "Last week you were interested in...")

Guidelines:
- Always use natural, conversational language
- When you search, briefly describe what you found before listing
- **ALWAYS show candidate scores (0-100) when listing search results** - format: "Name (Score: X/100)"
- Sort candidates by score (best to worst) and explicitly say "ranked by score"
- When analyzing, be thorough but concise (2-3 paragraphs)
- When comparing, give clear pros/cons and a recommendation
- Ask follow-up questions to understand their needs better
- Reference candidates by name (not just "candidate #1")
- Proactively suggest actions (e.g., "Want me to save these to a shortlist?" or "Should I email them?")
- When taking actions, confirm what you did
- Use memory to provide continuity across conversations
- LEARN from every interaction - preferences, decisions, patterns
- When asked for "all candidates" or "best to worst", list ALL results with scores

**CRITICAL Email Workflow:**
When asked to email a candidate:
1. If you don't have their info, FIRST use search_candidates to find them
2. THEN use email_candidate with their EXACT FULL NAME from search results
3. NEVER make up email addresses like "name@example.com"
4. Use the candidate's name as the identifier, NOT an invented email
Example: To email "Buthaina Alzoubi", use candidate_identifiers: ["Buthaina Alzoubi"]

Context: You're an adaptive AI recruiter that learns and improves with every conversation!`
    },
    ...dbMessages, // Load from database for true persistence
    { role: 'user', content: userMessage }
  ];

  // Initial GPT call with tools (with timeout protection)
  let response = await createCompletionWithTimeout(openai, {
    model: 'gpt-4o-mini',
    messages,
    tools,
    tool_choice: 'auto',
    temperature: 0.7,
    max_tokens: 1000
  }) as any;

  let assistantMessage = response.choices[0].message;
  
  // Handle tool calls
  while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
    // Execute all tool calls
    const toolResults = [];
    
    for (const toolCall of assistantMessage.tool_calls) {
      if (toolCall.type !== 'function') continue;
      const functionName = toolCall.function.name;
      const functionArgs = JSON.parse(toolCall.function.arguments);
      
      console.log(`[AGENT] Calling tool: ${functionName}`, functionArgs);
      
      let result;
      try {
        if (functionName === 'search_candidates') {
          result = await executeSearch(functionArgs, orgSlug);
        } else if (functionName === 'analyze_candidate') {
          result = await analyzeCandidate(functionArgs, orgSlug, conversationHistory);
        } else if (functionName === 'compare_candidates') {
          result = await compareCandidates(functionArgs, orgSlug);
        } else if (functionName === 'save_shortlist') {
          result = await saveShortlist(functionArgs, orgSlug, adminEmail);
        } else if (functionName === 'email_candidate') {
          result = await emailCandidate(functionArgs, orgSlug, adminEmail);
        } else if (functionName === 'export_results') {
          result = await exportResults(functionArgs, orgSlug);
        } else if (functionName === 'recall_memory') {
          result = await recallMemory(functionArgs, orgSlug, adminEmail);
        } else if (functionName === 'save_memory') {
          result = await saveMemory(functionArgs, orgSlug, adminEmail, sessionId);
        } else if (functionName === 'learn_preference') {
          result = await learnPreference(functionArgs, orgSlug, adminEmail);
        } else if (functionName === 'get_my_preferences') {
          result = await getMyPreferences(functionArgs, orgSlug, adminEmail);
        } else if (functionName === 'record_decision') {
          result = await recordDecision(functionArgs, orgSlug, adminEmail, sessionId);
        } else if (functionName === 'review_portfolio') {
          result = await reviewPortfolio(functionArgs, orgSlug);
        } else {
          result = { error: 'Unknown function' };
        }
      } catch (err: any) {
        result = { error: err.message };
      }
      
      toolResults.push({
        tool_call_id: toolCall.id,
        role: 'tool',
        name: functionName,
        content: JSON.stringify(result)
      });
    }
    
    // Add assistant message with tool calls
    messages.push(assistantMessage);
    
    // Add tool results
    messages.push(...toolResults);
    
    // Get next response from GPT (with timeout protection)
    response = await createCompletionWithTimeout(openai, {
      model: 'gpt-4o-mini',
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 1000
    }) as any;
    
    assistantMessage = response.choices[0].message;
  }

  // Save assistant's response to history
  await saveMessage(
    sessionId,
    orgId,
    adminEmail,
    'assistant',
    assistantMessage.content || 'No response generated'
  );

  return {
    response: assistantMessage.content,
    usage: response.usage,
    sessionId // Return sessionId for reference
  };
}

// Authorization helper - returns admin email if authorized
async function authorize(request: NextRequest, orgSlug: string): Promise<string | null> {
  try {
    const token = request.cookies.get('admin_session')?.value || '';
    if (!token) return null;
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production');
    const { payload } = await jwtVerify(token, secret);
    const tokenOrgSlug = String((payload as any)?.orgSlug || '');
    const adminEmail = String((payload as any)?.email || 'admin@system');
    return tokenOrgSlug === orgSlug ? adminEmail : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  // Rate limiting
  const rl = checkRateLimitWithConfig(request, { 
    maxRequests: 10, 
    windowMs: 5 * 60 * 1000,
    namespace: 'admin-agent-v2' 
  });
  if (!rl.success) return createRateLimitResponse(rl);

  try {
    const body = await request.json();
    const { message, history = [] } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const orgSlug = request.nextUrl.searchParams.get('org')?.trim() || '';
    if (!orgSlug) {
      return NextResponse.json({ error: 'Missing org' }, { status: 400 });
    }

    const adminEmail = await authorize(request, orgSlug);
    if (!adminEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Handle natural conversation with function calling
    const result = await handleConversation(message, history, orgSlug, adminEmail);
    
    const queryTime = Date.now() - startTime;
    console.log('[AGENT_V2]', {
      queryTime,
      tokensUsed: result.usage?.total_tokens || 0
    });

    return NextResponse.json({
      response: result.response,
      isNatural: true,
      queryTime
    });

  } catch (err: any) {
    console.error('[AGENT_V2] Error:', err?.message);
    return NextResponse.json(
      { error: 'Failed to process request', message: err?.message },
      { status: 500 }
    );
  }
}
