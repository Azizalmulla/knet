import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { createServerClient } from '@/lib/supabase-server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

interface DashboardData {
  profile: {
    name: string;
    email: string;
    phone: string;
    profileStrength: number;
    completionTips: string[];
    topSkills: string[];
    yearsExperience: number;
  };
  applications: {
    total: number;
    pending: number;
    reviewing: number;
    interviewed: number;
    accepted: number;
    rejected: number;
    recentApplications: any[];
  };
  matchedJobs: any[];
  upcomingInterviews: any[];
  recommendations: {
    skillsToLearn: string[];
    careerPaths: string[];
    improvementTips: string[];
  };
  activityFeed: any[];
}

/**
 * GET /api/candidate/dashboard
 * 
 * Comprehensive dashboard data for job seekers
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const candidateEmail = user.email.toLowerCase();

    // 1. Get candidate profile from latest submission
    const profileRes = await sql`
      SELECT 
        c.id,
        c.full_name,
        c.email,
        c.phone,
        c.cv_json,
        c.field_of_study,
        c.area_of_interest,
        c.years_of_experience,
        c.created_at,
        c.org_id,
        o.name as org_name,
        o.slug as org_slug
      FROM candidates c
      LEFT JOIN organizations o ON c.org_id = o.id
      WHERE LOWER(c.email) = ${candidateEmail}
      AND c.deleted_at IS NULL
      ORDER BY c.created_at DESC
      LIMIT 1
    `;

    if (profileRes.rows.length === 0) {
      // No profile yet - return empty dashboard
      return NextResponse.json({
        profile: {
          name: '',
          email: candidateEmail,
          phone: '',
          profileStrength: 0,
          completionTips: ['Upload your first CV to get started'],
          topSkills: [],
          yearsExperience: 0,
        },
        applications: {
          total: 0,
          pending: 0,
          reviewing: 0,
          interviewed: 0,
          accepted: 0,
          rejected: 0,
          recentApplications: [],
        },
        matchedJobs: [],
        upcomingInterviews: [],
        recommendations: {
          skillsToLearn: ['TypeScript', 'React', 'Python'],
          careerPaths: ['Software Developer', 'Data Analyst', 'Product Manager'],
          improvementTips: [
            'Upload your CV to get started',
            'Complete your profile for better job matches',
            'Explore available job postings',
          ],
        },
        activityFeed: [],
      });
    }

    const profile = profileRes.rows[0];

    // Parse CV data
    let cvData: any = {};
    try {
      const rawData = profile.cv_json;
      if (typeof rawData === 'string') {
        cvData = JSON.parse(rawData);
      } else if (rawData) {
        cvData = rawData;
      }
    } catch (e) {
      console.error('Failed to parse CV data:', e);
    }

    // Calculate profile strength (0-100)
    let profileStrength = 0;
    const completionTips: string[] = [];

    // Basic info (20 points)
    if (profile.full_name) profileStrength += 10;
    if (profile.email) profileStrength += 5;
    if (profile.phone) profileStrength += 5;
    else completionTips.push('Add your phone number');

    // Skills (25 points)
    const technicalSkills = cvData?.skills?.technical || [];
    const softSkills = cvData?.skills?.soft || [];
    if (technicalSkills.length > 0) profileStrength += 15;
    if (softSkills.length > 0) profileStrength += 10;
    if (technicalSkills.length === 0) completionTips.push('Add technical skills');
    if (technicalSkills.length < 5) completionTips.push('Add more technical skills (aim for 5+)');

    // Experience (25 points)
    const experience = cvData?.experience || [];
    if (experience.length > 0) profileStrength += 15;
    if (experience.length >= 2) profileStrength += 10;
    if (experience.length === 0) completionTips.push('Add work experience');
    if (experience.length === 1) completionTips.push('Add more work experience');

    // Education (15 points)
    const education = cvData?.education || [];
    if (education.length > 0) profileStrength += 15;
    if (education.length === 0) completionTips.push('Add your education');

    // Projects (15 points)
    const projects = cvData?.projects || [];
    if (projects.length > 0) profileStrength += 10;
    if (projects.length >= 2) profileStrength += 5;
    if (projects.length === 0) completionTips.push('Add projects to stand out');

    profileStrength = Math.min(100, profileStrength);

    // Top skills (for display)
    const topSkills = [...technicalSkills, ...softSkills].slice(0, 8);

    // Years of experience
    const yearsExperience = profile.years_of_experience || experience.length || 0;

    // 2. Get all applications (submissions to different orgs)
    let applicationsRes;
    try {
      applicationsRes = await sql`
        SELECT 
          c.id,
          c.full_name,
          c.created_at,
          c.parse_status,
          o.name as org_name,
          o.slug as org_slug,
          o.logo_url,
          COALESCE(d.status, 'pending') as decision_status,
          d.updated_at as decision_date
        FROM candidates c
        LEFT JOIN organizations o ON c.org_id = o.id
        LEFT JOIN candidate_decisions d ON d.candidate_id = c.id
        WHERE LOWER(c.email) = ${candidateEmail}
        AND c.deleted_at IS NULL
        ORDER BY c.created_at DESC
        LIMIT 50
      `;
    } catch (error) {
      console.log('[Dashboard] Error fetching applications:', error);
      // Fallback: try without decisions table
      try {
        applicationsRes = await sql`
          SELECT 
            c.id,
            c.full_name,
            c.created_at,
            c.parse_status,
            o.name as org_name,
            o.slug as org_slug,
            o.logo_url,
            'pending' as decision_status,
            NULL as decision_date
          FROM candidates c
          LEFT JOIN organizations o ON c.org_id = o.id
          WHERE LOWER(c.email) = ${candidateEmail}
          AND c.deleted_at IS NULL
          ORDER BY c.created_at DESC
          LIMIT 50
        `;
      } catch (fallbackError) {
        console.error('[Dashboard] Fallback query also failed:', fallbackError);
        applicationsRes = { rows: [] };
      }
    }

    const allApplications = applicationsRes.rows;

    // Count by status
    const statusCounts = {
      total: allApplications.length,
      pending: allApplications.filter(a => a.decision_status === 'pending').length,
      reviewing: allApplications.filter(a => a.decision_status === 'reviewing').length,
      interviewed: allApplications.filter(a => a.decision_status === 'interviewed').length,
      accepted: allApplications.filter(a => a.decision_status === 'accepted').length,
      rejected: allApplications.filter(a => a.decision_status === 'rejected').length,
    };

    // Recent applications (last 10)
    const recentApplications = allApplications.slice(0, 10).map(app => ({
      id: app.id,
      orgName: app.org_name,
      orgSlug: app.org_slug,
      orgLogo: app.logo_url,
      appliedAt: app.created_at,
      status: app.decision_status,
      decidedAt: app.decision_date,
    }));

    // 3. Get matched jobs (jobs that match candidate's skills)
    let jobsRes;
    try {
      jobsRes = await sql`
        SELECT 
          j.id,
          j.title,
          j.description,
          j.location,
          j.salary_min,
          j.salary_max,
          j.salary_currency,
          j.job_type,
          j.work_mode,
          j.skills,
          j.created_at,
          o.name as company_name,
          o.slug as company_slug,
          o.logo_url
        FROM jobs j
        JOIN organizations o ON j.org_id = o.id
        WHERE j.status = 'open'
        ORDER BY j.created_at DESC
        LIMIT 20
      `;
    } catch (error) {
      console.error('[Dashboard] Error fetching jobs:', error);
      jobsRes = { rows: [] };
    }

    // Simple matching: check if candidate skills match job requirements
    const matchedJobs = jobsRes.rows
      .map((job: any) => {
        const jobSkills = job.skills || [];
        const matchedSkills = jobSkills.filter((skill: string) =>
          topSkills.some(candSkill => 
            candSkill.toLowerCase().includes(skill.toLowerCase()) ||
            skill.toLowerCase().includes(candSkill.toLowerCase())
          )
        );
        
        const matchScore = jobSkills.length > 0 
          ? Math.round((matchedSkills.length / jobSkills.length) * 100)
          : 50;

        // Format salary range
        let salaryRange = 'Competitive';
        if (job.salary_min || job.salary_max) {
          const currency = job.salary_currency || 'KWD';
          if (job.salary_min && job.salary_max) {
            salaryRange = `${job.salary_min}-${job.salary_max} ${currency}`;
          } else if (job.salary_min) {
            salaryRange = `${job.salary_min}+ ${currency}`;
          } else if (job.salary_max) {
            salaryRange = `Up to ${job.salary_max} ${currency}`;
          }
        }

        return {
          ...job,
          matchScore,
          matchedSkills,
          salaryRange,
        };
      })
      .filter((job: any) => job.matchScore >= 30) // At least 30% match
      .sort((a: any, b: any) => b.matchScore - a.matchScore)
      .slice(0, 6)
      .map((job: any) => ({
        id: job.id,
        title: job.title,
        company: job.company_name,
        companySlug: job.company_slug,
        companyLogo: job.logo_url,
        location: job.location,
        salaryRange: job.salaryRange,
        jobType: job.job_type,
        workMode: job.work_mode,
        matchScore: job.matchScore,
        matchedSkills: job.matchedSkills,
        postedAt: job.created_at,
      }));

    // 4. Get upcoming interviews
    let interviewsRes;
    try {
      interviewsRes = await sql`
        SELECT 
          b.id,
          b.candidate_name,
          b.position_applying_for,
          b.interview_type,
          b.meeting_link,
          b.status,
          a.start_time,
          a.end_time,
          a.duration_minutes,
          o.name as company_name,
          o.slug as company_slug
        FROM interview_bookings b
        JOIN interview_availability a ON b.availability_id = a.id
        JOIN organizations o ON b.organization_id = o.id
        WHERE LOWER(b.candidate_email) = ${candidateEmail}
        AND b.status = 'confirmed'
        AND a.start_time > NOW()
        ORDER BY a.start_time ASC
        LIMIT 10
      `;
    } catch (error) {
      console.log('[Dashboard] Interview tables not found or error, skipping interviews');
      interviewsRes = { rows: [] };
    }

    const upcomingInterviews = interviewsRes.rows.map((interview: any) => ({
      id: interview.id,
      company: interview.company_name,
      companySlug: interview.company_slug,
      position: interview.position_applying_for,
      type: interview.interview_type,
      startTime: interview.start_time,
      endTime: interview.end_time,
      duration: interview.duration_minutes,
      meetingLink: interview.meeting_link,
      status: interview.status,
    }));

    // 5. Generate AI recommendations (if OpenAI available)
    let recommendations = {
      skillsToLearn: [] as string[],
      careerPaths: [] as string[],
      improvementTips: [] as string[],
    };

    if (openai && topSkills.length > 0) {
      try {
        const prompt = `You are a career advisor. Based on this candidate's profile:
- Current skills: ${topSkills.join(', ')}
- Field: ${profile.field_of_study || 'Not specified'}
- Experience: ${yearsExperience} years
- Recent applications: ${allApplications.length}

Provide career recommendations in JSON format:
{
  "skillsToLearn": ["skill1", "skill2", "skill3"], // 3 skills to learn next
  "careerPaths": ["path1", "path2", "path3"], // 3 potential career paths
  "improvementTips": ["tip1", "tip2", "tip3"] // 3 actionable tips
}

Be specific, practical, and encouraging.`;

        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 500,
          response_format: { type: 'json_object' },
        });

        const aiRecs = JSON.parse(response.choices[0]?.message?.content || '{}');
        recommendations = {
          skillsToLearn: aiRecs.skillsToLearn || [],
          careerPaths: aiRecs.careerPaths || [],
          improvementTips: aiRecs.improvementTips || [],
        };
      } catch (err) {
        console.error('AI recommendations error:', err);
        // Fallback recommendations
        recommendations = {
          skillsToLearn: ['TypeScript', 'React', 'Python'],
          careerPaths: ['Full Stack Developer', 'Data Analyst', 'Product Manager'],
          improvementTips: [
            'Add more projects to your portfolio',
            'Get certified in trending technologies',
            'Build a strong LinkedIn presence',
          ],
        };
      }
    } else {
      // Fallback recommendations
      recommendations = {
        skillsToLearn: ['TypeScript', 'React', 'Python'],
        careerPaths: ['Full Stack Developer', 'Data Analyst', 'Product Manager'],
        improvementTips: [
          'Add more projects to your portfolio',
          'Get certified in trending technologies',
          'Build a strong LinkedIn presence',
        ],
      };
    }

    // 6. Build activity feed
    const activityFeed = [
      ...recentApplications.map(app => ({
        type: 'application',
        message: `Applied to ${app.orgName}`,
        timestamp: app.appliedAt,
        status: app.status,
      })),
      ...upcomingInterviews.map(int => ({
        type: 'interview',
        message: `Interview scheduled with ${int.company}`,
        timestamp: int.startTime,
        status: 'upcoming',
      })),
    ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);

    // Build final response
    const dashboardData: DashboardData = {
      profile: {
        name: profile.full_name,
        email: profile.email,
        phone: profile.phone || '',
        profileStrength,
        completionTips,
        topSkills,
        yearsExperience,
      },
      applications: {
        ...statusCounts,
        recentApplications,
      },
      matchedJobs,
      upcomingInterviews,
      recommendations,
      activityFeed,
    };

    return NextResponse.json(dashboardData);

  } catch (error: any) {
    console.error('[Candidate Dashboard API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load dashboard', details: error.message },
      { status: 500 }
    );
  }
}
