import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { jwtVerify } from '@/lib/esm-compat/jose';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SkillData {
  skill: string;
  count: number;
  percentage: number;
  category: 'abundant' | 'balanced' | 'scarce';
}

interface GapAnalysis {
  totalCandidates: number;
  abundantSkills: SkillData[]; // >60% of candidates
  balancedSkills: SkillData[]; // 30-60%
  scarceSkills: SkillData[]; // <30%
  recommendations: string[];
  industryInsights: {
    topTrendingSkills: string[];
    emergingSkills: string[];
  };
}

// Industry benchmarks (can be updated based on market data)
const INDUSTRY_TRENDING = [
  'React', 'TypeScript', 'Python', 'AWS', 'Docker', 'Kubernetes',
  'Machine Learning', 'Data Science', 'Cybersecurity', 'Cloud Computing'
];

const INDUSTRY_EMERGING = [
  'Rust', 'WebAssembly', 'Edge Computing', 'Quantum Computing',
  'AI/ML Ops', 'Web3', 'Blockchain', 'AR/VR'
];

/**
 * GET /api/[org]/admin/skills-gap
 * 
 * Returns comprehensive skills gap analysis for the organization
 * - Which skills are abundant (oversupplied)
 * - Which skills are scarce (undersupplied)
 * - Training/hiring recommendations
 * - Industry benchmarking
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { org: string } }
) {
  try {
    const orgSlug = params.org;

    // Verify JWT
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret-key';
    let decoded: any;
    
    try {
      const result = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
      decoded = result.payload;
    } catch (jwtError) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (decoded.org !== orgSlug) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get organization
    const orgRes = await sql`
      SELECT id, name FROM organizations WHERE slug = ${orgSlug} LIMIT 1
    `;
    
    if (!orgRes.rows.length) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    
    const org = orgRes.rows[0];
    const orgId = org.id;

    // Fetch all candidates with CV data
    const candidatesRes = await sql`
      SELECT 
        id,
        cv_json,
        cv_data,
        field_of_study,
        area_of_interest
      FROM candidates
      WHERE organization_id = ${orgId}::uuid
      AND deleted_at IS NULL
    `;

    const totalCandidates = candidatesRes.rows.length;

    if (totalCandidates === 0) {
      return NextResponse.json({
        totalCandidates: 0,
        abundantSkills: [],
        balancedSkills: [],
        scarceSkills: [],
        recommendations: ['Upload candidate CVs to see skills gap analysis'],
        industryInsights: {
          topTrendingSkills: INDUSTRY_TRENDING.slice(0, 5),
          emergingSkills: INDUSTRY_EMERGING.slice(0, 5),
        },
      });
    }

    // Extract all skills from candidates
    const skillsMap = new Map<string, number>();

    for (const candidate of candidatesRes.rows) {
      let cvData: any = {};
      
      try {
        // Try cv_json first, fallback to cv_data
        const rawData = candidate.cv_json || candidate.cv_data;
        if (typeof rawData === 'string') {
          cvData = JSON.parse(rawData);
        } else if (rawData) {
          cvData = rawData;
        }
      } catch (e) {
        console.error('Failed to parse CV data:', e);
        continue;
      }

      // Extract technical skills
      const technicalSkills = cvData?.skills?.technical || [];
      const softSkills = cvData?.skills?.soft || [];
      const languages = cvData?.languages || [];
      const tools = cvData?.tools || [];

      // Count all skills
      const allSkills = [
        ...technicalSkills,
        ...softSkills,
        ...languages,
        ...tools,
      ];

      allSkills.forEach((skill: string) => {
        if (skill && typeof skill === 'string') {
          const normalized = skill.trim().toLowerCase();
          if (normalized.length > 0) {
            skillsMap.set(normalized, (skillsMap.get(normalized) || 0) + 1);
          }
        }
      });
    }

    // Convert to array and calculate percentages
    const skillsArray: SkillData[] = Array.from(skillsMap.entries())
      .map(([skill, count]) => {
        const percentage = Math.round((count / totalCandidates) * 100);
        const ratio = count / totalCandidates;
        const category: 'abundant' | 'balanced' | 'scarce' = 
          ratio > 0.6 ? 'abundant' :
          ratio > 0.3 ? 'balanced' :
          'scarce';
        
        return { skill, count, percentage, category };
      })
      .sort((a, b) => b.count - a.count);

    // Categorize skills
    const abundantSkills = skillsArray.filter(s => s.category === 'abundant');
    const balancedSkills = skillsArray.filter(s => s.category === 'balanced');
    const scarceSkills = skillsArray.filter(s => s.category === 'scarce');

    // Generate recommendations
    const recommendations: string[] = [];

    // Find trending skills that are scarce
    const trendingButScarce = INDUSTRY_TRENDING.filter(trending => 
      !skillsArray.some(s => 
        s.skill.includes(trending.toLowerCase()) && s.percentage > 20
      )
    );

    if (trendingButScarce.length > 0) {
      recommendations.push(
        `High-demand skills gap: ${trendingButScarce.slice(0, 3).join(', ')}. Consider targeted recruitment or training programs.`
      );
    }

    // Abundant skills recommendation
    if (abundantSkills.length > 0) {
      recommendations.push(
        `Strong talent pool in: ${abundantSkills.slice(0, 3).map(s => s.skill).join(', ')}. Leverage these for project staffing.`
      );
    }

    // Emerging skills recommendation
    const emergingButMissing = INDUSTRY_EMERGING.filter(emerging =>
      !skillsArray.some(s => s.skill.includes(emerging.toLowerCase()))
    );

    if (emergingButMissing.length > 0) {
      recommendations.push(
        `Future-proof your team: ${emergingButMissing.slice(0, 3).join(', ')} are emerging skills with low representation.`
      );
    }

    // Diversity recommendation
    if (skillsArray.length < 20) {
      recommendations.push(
        'Limited skill diversity. Consider broadening recruitment channels or hiring for complementary skills.'
      );
    }

    // Training opportunity
    if (scarceSkills.length > abundantSkills.length) {
      recommendations.push(
        'High skills gap detected. Internal training programs could address multiple shortages efficiently.'
      );
    }

    // Build response
    const analysis: GapAnalysis = {
      totalCandidates,
      abundantSkills: abundantSkills.slice(0, 15),
      balancedSkills: balancedSkills.slice(0, 15),
      scarceSkills: scarceSkills.slice(0, 15),
      recommendations: recommendations.slice(0, 5),
      industryInsights: {
        topTrendingSkills: INDUSTRY_TRENDING.slice(0, 8),
        emergingSkills: INDUSTRY_EMERGING.slice(0, 8),
      },
    };

    return NextResponse.json(analysis);

  } catch (error: any) {
    console.error('[Skills Gap API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze skills gap', details: error.message },
      { status: 500 }
    );
  }
}
