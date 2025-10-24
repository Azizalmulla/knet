import { sql } from '@vercel/postgres';

export interface PortfolioLinks {
  github?: string;
  behance?: string;
  dribbble?: string;
  linkedin?: string;
  website?: string;
}

export interface PortfolioAnalysis {
  overall_quality_score: number;
  quality_rating: string;
  strengths: string[];
  concerns: string[];
  style_description?: string;
  best_work_summary?: string;
  ai_recommendation: string;
}

/**
 * Extract portfolio links from candidate data
 */
export function extractPortfolioLinks(candidate: any): PortfolioLinks {
  const links: PortfolioLinks = {};

  // Direct fields
  if (candidate.github_url) links.github = candidate.github_url;
  if (candidate.behance_url) links.behance = candidate.behance_url;
  if (candidate.dribbble_url) links.dribbble = candidate.dribbble_url;
  if (candidate.linkedin_url) links.linkedin = candidate.linkedin_url;
  if (candidate.portfolio_url) links.website = candidate.portfolio_url;

  return links;
}

/**
 * Scrape GitHub profile data
 */
export async function scrapeGitHub(githubUrl: string): Promise<any> {
  try {
    // Extract username from URL
    const username = githubUrl.replace(/https?:\/\/(www\.)?github\.com\//, '').split('/')[0];
    
    if (!username) {
      throw new Error('Invalid GitHub URL');
    }

    // Use GitHub API if token available
    if (process.env.GITHUB_TOKEN) {
      const response = await fetch(`https://api.github.com/users/${username}`, {
        headers: {
          'Authorization': `token ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const userData = await response.json();

      // Get repositories
      const reposResponse = await fetch(`https://api.github.com/users/${username}/repos?sort=stars&per_page=10`, {
        headers: {
          'Authorization': `token ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      const repos = reposResponse.ok ? await reposResponse.json() : [];

      // Calculate metrics
      const totalStars = repos.reduce((sum: number, repo: any) => sum + (repo.stargazers_count || 0), 0);
      const totalForks = repos.reduce((sum: number, repo: any) => sum + (repo.forks_count || 0), 0);
      const languages = [...new Set(repos.map((r: any) => r.language).filter(Boolean))];

      return {
        username: userData.login,
        repos: userData.public_repos || 0,
        stars: totalStars,
        forks: totalForks,
        followers: userData.followers || 0,
        languages: languages,
        top_repos: repos.slice(0, 5).map((r: any) => ({
          name: r.name,
          description: r.description,
          stars: r.stargazers_count,
          language: r.language,
          url: r.html_url
        }))
      };
    }

    // Fallback: Basic scraping (limited data)
    return {
      username: username,
      repos: 0,
      stars: 0,
      note: 'Limited data - GitHub token not configured'
    };

  } catch (error: any) {
    console.error('[GITHUB_SCRAPE] Error:', error.message);
    return { error: error.message };
  }
}

/**
 * Scrape Behance profile data
 */
export async function scrapeBehance(behanceUrl: string): Promise<any> {
  try {
    // Extract username
    const username = behanceUrl.replace(/https?:\/\/(www\.)?behance\.net\//, '').split('/')[0];
    
    if (!username) {
      throw new Error('Invalid Behance URL');
    }

    // Behance API requires API key
    if (process.env.BEHANCE_API_KEY) {
      const response = await fetch(`https://api.behance.net/v2/users/${username}?api_key=${process.env.BEHANCE_API_KEY}`);
      
      if (response.ok) {
        const data = await response.json();
        const user = data.user;

        // Get projects
        const projectsResponse = await fetch(`https://api.behance.net/v2/users/${username}/projects?api_key=${process.env.BEHANCE_API_KEY}`);
        const projectsData = projectsResponse.ok ? await projectsResponse.json() : { projects: [] };

        return {
          username: user.username,
          projects: projectsData.projects?.length || 0,
          followers: user.stats?.followers || 0,
          views: user.stats?.views || 0,
          appreciations: user.stats?.appreciations || 0,
          top_projects: projectsData.projects?.slice(0, 5).map((p: any) => ({
            name: p.name,
            views: p.stats?.views || 0,
            appreciations: p.stats?.appreciations || 0,
            url: p.url
          })) || []
        };
      }
    }

    // Fallback: Basic data
    return {
      username: username,
      projects: 0,
      note: 'Limited data - Behance API key not configured'
    };

  } catch (error: any) {
    console.error('[BEHANCE_SCRAPE] Error:', error.message);
    return { error: error.message };
  }
}

/**
 * Analyze portfolio data using AI
 */
export async function analyzePortfolioWithAI(
  candidateName: string,
  portfolioData: any,
  cvText?: string
): Promise<PortfolioAnalysis> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      // Fallback analysis without AI
      return generateBasicAnalysis(portfolioData);
    }

    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Build context
    const context = `
Candidate: ${candidateName}

Portfolio Data:
${JSON.stringify(portfolioData, null, 2)}

${cvText ? `CV Summary: ${cvText.substring(0, 500)}` : ''}

Analyze this candidate's portfolio and provide:
1. Overall quality score (0-10)
2. Key strengths (3-5 points)
3. Any concerns or gaps (2-3 points)
4. Style description (for designers)
5. Best work summary
6. Recommendation for hiring

Be specific and reference actual projects/repos.
    `.trim();

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a technical recruiter analyzing candidate portfolios. Be honest, specific, and constructive.'
        },
        {
          role: 'user',
          content: context
        }
      ],
      temperature: 0.7,
      max_tokens: 800
    });

    const analysis = response.choices[0].message.content || '';

    // Parse AI response (simplified - in production, use structured output)
    const strengths = extractListItems(analysis, 'strength');
    const concerns = extractListItems(analysis, 'concern');
    
    // Extract quality score
    const scoreMatch = analysis.match(/(\d+(?:\.\d+)?)\s*\/\s*10|score.*?(\d+(?:\.\d+)?)/i);
    const score = scoreMatch ? parseFloat(scoreMatch[1] || scoreMatch[2]) : 7.0;

    return {
      overall_quality_score: score,
      quality_rating: getQualityRating(score),
      strengths: strengths.length > 0 ? strengths : ['Portfolio analysis complete'],
      concerns: concerns.length > 0 ? concerns : ['No major concerns identified'],
      ai_recommendation: analysis.substring(0, 500)
    };

  } catch (error: any) {
    console.error('[PORTFOLIO_AI_ANALYSIS] Error:', error.message);
    return generateBasicAnalysis(portfolioData);
  }
}

/**
 * Generate basic analysis without AI
 */
function generateBasicAnalysis(portfolioData: any): PortfolioAnalysis {
  const strengths: string[] = [];
  const concerns: string[] = [];
  let score = 5.0;

  // GitHub analysis
  if (portfolioData.github) {
    if (portfolioData.github.repos > 20) {
      strengths.push(`Active on GitHub with ${portfolioData.github.repos} repositories`);
      score += 1;
    }
    if (portfolioData.github.stars > 100) {
      strengths.push(`Strong community recognition with ${portfolioData.github.stars} stars`);
      score += 1;
    }
    if (portfolioData.github.repos < 5) {
      concerns.push('Limited GitHub activity');
      score -= 0.5;
    }
  }

  // Behance analysis
  if (portfolioData.behance) {
    if (portfolioData.behance.projects > 15) {
      strengths.push(`Extensive portfolio with ${portfolioData.behance.projects} projects`);
      score += 1;
    }
    if (portfolioData.behance.views > 10000) {
      strengths.push(`High visibility with ${portfolioData.behance.views} total views`);
      score += 0.5;
    }
    if (portfolioData.behance.projects < 5) {
      concerns.push('Limited portfolio work');
      score -= 0.5;
    }
  }

  score = Math.max(1, Math.min(10, score)); // Clamp between 1-10

  return {
    overall_quality_score: score,
    quality_rating: getQualityRating(score),
    strengths: strengths.length > 0 ? strengths : ['Portfolio data available'],
    concerns: concerns.length > 0 ? concerns : ['Standard portfolio'],
    ai_recommendation: 'Portfolio analysis based on available data'
  };
}

/**
 * Get quality rating from score
 */
function getQualityRating(score: number): string {
  if (score >= 9) return 'Exceptional';
  if (score >= 8) return 'Excellent';
  if (score >= 7) return 'High';
  if (score >= 6) return 'Good';
  if (score >= 5) return 'Medium';
  if (score >= 4) return 'Fair';
  return 'Low';
}

/**
 * Extract list items from text
 */
function extractListItems(text: string, keyword: string): string[] {
  const lines = text.split('\n');
  const items: string[] = [];
  
  for (const line of lines) {
    if (line.toLowerCase().includes(keyword) && (line.includes('-') || line.includes('•') || /^\d+\./.test(line))) {
      const cleaned = line.replace(/^[-•\d.\s]+/, '').trim();
      if (cleaned.length > 10) {
        items.push(cleaned);
      }
    }
  }
  
  return items.slice(0, 5); // Max 5 items
}

/**
 * Save portfolio analysis to database
 */
export async function savePortfolioAnalysis(
  candidateId: string,
  orgId: string,
  portfolioData: any,
  analysis: PortfolioAnalysis
): Promise<void> {
  const github = portfolioData.github || {};
  const behance = portfolioData.behance || {};

  // Use direct query to handle arrays properly
  const strengthsArray = `{${analysis.strengths.map(s => `"${s.replace(/"/g, '\\"')}"`).join(',')}}`;
  const concernsArray = `{${analysis.concerns.map(c => `"${c.replace(/"/g, '\\"')}"`).join(',')}}`;

  await sql`
    INSERT INTO portfolio_analyses (
      candidate_id, org_id,
      github_url, github_username, github_repos, github_stars, github_forks,
      github_followers, github_languages, github_top_repos,
      behance_url, behance_username, behance_projects, behance_followers,
      behance_views, behance_appreciations, behance_top_projects,
      overall_quality_score, quality_rating, strengths, concerns,
      ai_recommendation, analyzed_at, cache_expires_at
    )
    VALUES (
      ${candidateId}::uuid, ${orgId}::uuid,
      ${github.url || null}, ${github.username || null}, ${github.repos || 0}, 
      ${github.stars || 0}, ${github.forks || 0}, ${github.followers || 0},
      ${JSON.stringify(github.languages || [])}::jsonb,
      ${JSON.stringify(github.top_repos || [])}::jsonb,
      ${behance.url || null}, ${behance.username || null}, ${behance.projects || 0},
      ${behance.followers || 0}, ${behance.views || 0}, ${behance.appreciations || 0},
      ${JSON.stringify(behance.top_projects || [])}::jsonb,
      ${analysis.overall_quality_score}, ${analysis.quality_rating},
      ${strengthsArray}::text[], ${concernsArray}::text[],
      ${analysis.ai_recommendation}, now(), now() + interval '30 days'
    )
    ON CONFLICT (candidate_id)
    DO UPDATE SET
      github_repos = EXCLUDED.github_repos,
      github_stars = EXCLUDED.github_stars,
      behance_projects = EXCLUDED.behance_projects,
      overall_quality_score = EXCLUDED.overall_quality_score,
      quality_rating = EXCLUDED.quality_rating,
      strengths = EXCLUDED.strengths,
      concerns = EXCLUDED.concerns,
      ai_recommendation = EXCLUDED.ai_recommendation,
      analyzed_at = now(),
      cache_expires_at = now() + interval '30 days'
  `;
}

/**
 * Get cached portfolio analysis
 */
export async function getCachedPortfolioAnalysis(candidateId: string): Promise<any | null> {
  const result = await sql`
    SELECT *
    FROM portfolio_analyses
    WHERE candidate_id = ${candidateId}::uuid
      AND cache_expires_at > now()
    LIMIT 1
  `;

  return result.rows.length > 0 ? result.rows[0] : null;
}
