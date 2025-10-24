import { sql } from '@vercel/postgres';

export interface UserPreference {
  preference_key: string;
  preference_value: string;
  confidence_score: number;
  evidence_count: number;
}

export interface HiringDecision {
  candidate_name: string;
  decision: 'hired' | 'rejected' | 'interviewed' | 'shortlisted' | 'passed';
  reason: string;
  factors: any;
}

/**
 * Record a user preference with confidence scoring
 */
export async function recordPreference(
  orgId: string,
  adminEmail: string,
  preferenceKey: string,
  preferenceValue: string,
  reinforcement: boolean = false
): Promise<void> {
  if (reinforcement) {
    // Reinforce existing preference
    await sql`
      INSERT INTO user_preferences (org_id, admin_email, preference_key, preference_value, confidence_score, evidence_count)
      VALUES (${orgId}::uuid, ${adminEmail}, ${preferenceKey}, ${preferenceValue}, 0.6, 1)
      ON CONFLICT (org_id, admin_email, preference_key)
      DO UPDATE SET
        preference_value = ${preferenceValue},
        confidence_score = LEAST(user_preferences.confidence_score + 0.1, 1.0),
        evidence_count = user_preferences.evidence_count + 1,
        last_reinforced_at = now()
    `;
  } else {
    // New preference
    await sql`
      INSERT INTO user_preferences (org_id, admin_email, preference_key, preference_value, confidence_score, evidence_count)
      VALUES (${orgId}::uuid, ${adminEmail}, ${preferenceKey}, ${preferenceValue}, 0.5, 1)
      ON CONFLICT (org_id, admin_email, preference_key)
      DO UPDATE SET
        preference_value = ${preferenceValue},
        last_reinforced_at = now()
    `;
  }
}

/**
 * Get user preferences with confidence threshold
 */
export async function getUserPreferences(
  orgId: string,
  adminEmail: string,
  minConfidence: number = 0.5
): Promise<UserPreference[]> {
  const result = await sql`
    SELECT 
      preference_key,
      preference_value,
      confidence_score,
      evidence_count
    FROM user_preferences
    WHERE org_id = ${orgId}::uuid
      AND admin_email = ${adminEmail}
      AND confidence_score >= ${minConfidence}
    ORDER BY confidence_score DESC, evidence_count DESC
  `;

  return result.rows as UserPreference[];
}

/**
 * Record a hiring decision
 */
export async function recordHiringDecision(
  orgId: string,
  adminEmail: string,
  candidateId: string | null,
  candidateName: string,
  decision: 'hired' | 'rejected' | 'interviewed' | 'shortlisted' | 'passed',
  reason: string,
  factors: any = {},
  sessionId: string | null = null
): Promise<void> {
  await sql`
    INSERT INTO hiring_decisions (
      org_id, admin_email, candidate_id, candidate_name,
      decision, reason, factors, session_id
    )
    VALUES (
      ${orgId}::uuid,
      ${adminEmail},
      ${candidateId ? `${candidateId}::uuid` : null},
      ${candidateName},
      ${decision},
      ${reason},
      ${JSON.stringify(factors)}::jsonb,
      ${sessionId ? `${sessionId}::uuid` : null}
    )
  `;
}

/**
 * Get hiring patterns for an admin
 */
export async function getHiringPatterns(
  orgId: string,
  adminEmail: string,
  limit: number = 50
): Promise<HiringDecision[]> {
  const result = await sql`
    SELECT 
      candidate_name,
      decision,
      reason,
      factors,
      decided_at
    FROM hiring_decisions
    WHERE org_id = ${orgId}::uuid
      AND admin_email = ${adminEmail}
    ORDER BY decided_at DESC
    LIMIT ${limit}
  `;

  return result.rows as HiringDecision[];
}

/**
 * Record a search pattern
 */
export async function recordSearchPattern(
  orgId: string,
  adminEmail: string,
  searchType: string,
  queryText: string,
  filtersUsed: any = {},
  resultsCount: number = 0,
  candidatesViewed: string[] = [],
  sessionId: string | null = null
): Promise<void> {
  await sql`
    INSERT INTO search_patterns (
      org_id, admin_email, search_type, query_text,
      filters_used, results_count, candidates_viewed, session_id
    )
    VALUES (
      ${orgId}::uuid,
      ${adminEmail},
      ${searchType},
      ${queryText},
      ${JSON.stringify(filtersUsed)}::jsonb,
      ${resultsCount},
      ${JSON.stringify(candidatesViewed)}::jsonb,
      ${sessionId ? `${sessionId}::uuid` : null}
    )
  `;
}

/**
 * Get common search patterns
 */
export async function getSearchPatterns(
  orgId: string,
  adminEmail: string,
  limit: number = 20
): Promise<any[]> {
  const result = await sql`
    SELECT 
      search_type,
      query_text,
      filters_used,
      COUNT(*) as frequency,
      AVG(results_count) as avg_results
    FROM search_patterns
    WHERE org_id = ${orgId}::uuid
      AND admin_email = ${adminEmail}
      AND searched_at > now() - interval '30 days'
    GROUP BY search_type, query_text, filters_used
    ORDER BY frequency DESC
    LIMIT ${limit}
  `;

  return result.rows;
}

/**
 * Record candidate interaction
 */
export async function recordCandidateInteraction(
  orgId: string,
  adminEmail: string,
  candidateId: string,
  interactionType: string,
  interactionData: any = {},
  sessionId: string | null = null
): Promise<void> {
  await sql`
    INSERT INTO candidate_interactions (
      org_id, admin_email, candidate_id, interaction_type,
      interaction_data, session_id
    )
    VALUES (
      ${orgId}::uuid,
      ${adminEmail},
      ${candidateId}::uuid,
      ${interactionType},
      ${JSON.stringify(interactionData)}::jsonb,
      ${sessionId ? `${sessionId}::uuid` : null}
    )
  `;
}

/**
 * Analyze user behavior and extract preferences
 */
export async function analyzeUserBehavior(
  orgId: string,
  adminEmail: string
): Promise<{
  preferences: string[];
  patterns: string[];
  recommendations: string[];
}> {
  // Get hiring decisions
  const decisions = await getHiringPatterns(orgId, adminEmail, 50);
  
  // Get search patterns
  const searches = await getSearchPatterns(orgId, adminEmail, 20);
  
  // Get preferences
  const prefs = await getUserPreferences(orgId, adminEmail, 0.6);

  const preferences: string[] = [];
  const patterns: string[] = [];
  const recommendations: string[] = [];

  // Analyze preferences
  for (const pref of prefs) {
    preferences.push(`${pref.preference_key}: ${pref.preference_value} (${Math.round(pref.confidence_score * 100)}% confident)`);
  }

  // Analyze hiring decisions
  const hired = decisions.filter(d => d.decision === 'hired');
  const rejected = decisions.filter(d => d.decision === 'rejected');
  
  if (hired.length > 0) {
    patterns.push(`Hired ${hired.length} candidates in recent history`);
  }
  
  if (rejected.length > 0) {
    patterns.push(`Rejected ${rejected.length} candidates in recent history`);
  }

  // Analyze search patterns
  if (searches.length > 0) {
    const topSearch = searches[0];
    patterns.push(`Most common search: "${topSearch.query_text}" (${topSearch.frequency} times)`);
  }

  // Generate recommendations
  if (prefs.length > 0) {
    recommendations.push('Apply learned preferences to future searches automatically');
  }
  
  if (searches.length > 2) {
    recommendations.push('Consider saving frequent searches as templates');
  }

  return { preferences, patterns, recommendations };
}

/**
 * Get adaptive search suggestions based on user behavior
 */
export async function getAdaptiveSearchSuggestions(
  orgId: string,
  adminEmail: string,
  currentQuery: string
): Promise<{
  suggestedFilters: any;
  reasoning: string[];
}> {
  const prefs = await getUserPreferences(orgId, adminEmail, 0.7);
  const searches = await getSearchPatterns(orgId, adminEmail, 10);

  const suggestedFilters: any = {};
  const reasoning: string[] = [];

  // Apply high-confidence preferences
  for (const pref of prefs) {
    if (pref.preference_key === 'min_gpa' && pref.confidence_score >= 0.7) {
      suggestedFilters.min_gpa = parseFloat(pref.preference_value);
      reasoning.push(`You typically prefer GPA >= ${pref.preference_value}`);
    }
    
    if (pref.preference_key === 'experience_level' && pref.confidence_score >= 0.7) {
      reasoning.push(`You usually look for ${pref.preference_value} candidates`);
    }
    
    if (pref.preference_key === 'preferred_skills' && pref.confidence_score >= 0.7) {
      reasoning.push(`You often search for ${pref.preference_value} skills`);
    }
  }

  // Learn from search patterns
  const relevantSearches = searches.filter(s => 
    s.query_text && s.query_text.toLowerCase().includes(currentQuery.toLowerCase())
  );

  if (relevantSearches.length > 0) {
    const commonFilters = relevantSearches[0].filters_used;
    if (commonFilters && Object.keys(commonFilters).length > 0) {
      Object.assign(suggestedFilters, commonFilters);
      reasoning.push('Based on your similar past searches');
    }
  }

  return { suggestedFilters, reasoning };
}

/**
 * Learn from user feedback on a candidate
 */
export async function learnFromFeedback(
  orgId: string,
  adminEmail: string,
  candidateData: any,
  feedback: 'positive' | 'negative',
  reason: string
): Promise<void> {
  // Extract learnable patterns from feedback
  if (feedback === 'positive') {
    // Reinforce positive traits
    if (candidateData.gpa && candidateData.gpa >= 3.5) {
      await recordPreference(orgId, adminEmail, 'min_gpa', '3.5', true);
    }
    
    if (candidateData.field_of_study) {
      await recordPreference(orgId, adminEmail, 'preferred_field', candidateData.field_of_study, true);
    }
  } else {
    // Learn from rejections
    if (reason.toLowerCase().includes('experience')) {
      await recordPreference(orgId, adminEmail, 'experience_level', 'senior', true);
    }
    
    if (reason.toLowerCase().includes('gpa')) {
      await recordPreference(orgId, adminEmail, 'min_gpa', '3.0', true);
    }
  }
}
