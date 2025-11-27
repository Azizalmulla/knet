import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

/**
 * POST /api/ai/extract-cv
 * 
 * Extracts structured CV data from any text input:
 * - Pasted CV text
 * - LinkedIn profile text
 * - Short description
 * - Any freeform text about a person
 * 
 * Returns structured data + identifies missing required fields
 */
export async function POST(request: NextRequest) {
  try {
    if (!openai) {
      return NextResponse.json({ 
        error: 'OpenAI not configured' 
      }, { status: 500 });
    }

    const body = await request.json();
    const { text, targetRole } = body;

    if (!text || typeof text !== 'string' || text.trim().length < 10) {
      return NextResponse.json({ 
        error: 'Please provide more information about yourself' 
      }, { status: 400 });
    }

    // Extract structured CV data using GPT
    const systemPrompt = `You are an expert CV parser. Extract structured CV information from any text input.
The user may provide:
- Full CV text
- LinkedIn profile copy-paste
- A short paragraph about themselves
- Just basic info like "Ahmed, CS from KU, worked at Zain"

EXTRACT AS MUCH AS POSSIBLE. For missing info, use reasonable defaults or leave empty.

OUTPUT REQUIREMENTS:
- Return ONLY valid JSON
- Use the exact schema provided
- Extract ALL mentioned information
- For dates, use format: "MM/YYYY" or "YYYY"
- Default location to "Kuwait" if not specified
- Default phone to "+965 " if not specified

SCHEMA:
{
  "fullName": string (required),
  "email": string (may be empty),
  "phone": string (default: "+965 "),
  "location": string (default: "Kuwait"),
  "headline": string (job title or "Fresh Graduate"),
  "summary": string (2-3 sentences, generate if not provided),
  "education": [
    {
      "institution": string,
      "degree": string,
      "fieldOfStudy": string,
      "startDate": string,
      "endDate": string,
      "currentlyStudying": boolean,
      "gpa": string
    }
  ],
  "experienceProjects": [
    {
      "type": "experience" | "project",
      "company": string (for experience),
      "position": string (for experience),
      "name": string (for project),
      "description": string,
      "startDate": string,
      "endDate": string,
      "current": boolean,
      "bullets": string[],
      "technologies": string[]
    }
  ],
  "skills": {
    "technical": string[],
    "frameworks": string[],
    "tools": string[],
    "databases": string[],
    "cloud": string[],
    "languages": string[],
    "soft": string[]
  },
  "certifications": string[],
  "achievements": string[],
  "links": {
    "linkedin": string,
    "github": string,
    "portfolio": string
  }
}

IMPORTANT:
- If they only mention a company name, infer it was work experience
- If they mention a university, extract it as education
- Generate a professional summary if not provided
- Extract skills from context (mentioned technologies, tools, etc.)
- Be generous with inference - help the user succeed`;

    const userPrompt = `Extract CV information from this text:

"""
${text.slice(0, 8000)}
"""

${targetRole ? `Target role: ${targetRole}` : ''}

Return the structured JSON.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    let cvData;
    try {
      cvData = JSON.parse(content);
    } catch {
      throw new Error('Failed to parse AI response');
    }

    // Normalize the data
    const normalizedData = {
      fullName: cvData.fullName || '',
      email: cvData.email || '',
      phone: cvData.phone || '+965 ',
      location: cvData.location || 'Kuwait',
      headline: cvData.headline || '',
      summary: cvData.summary || '',
      education: Array.isArray(cvData.education) ? cvData.education.map((edu: any) => ({
        institution: edu.institution || '',
        degree: edu.degree || '',
        fieldOfStudy: edu.fieldOfStudy || '',
        startDate: edu.startDate || '',
        endDate: edu.endDate || '',
        currentlyStudying: edu.currentlyStudying || false,
        gpa: edu.gpa || '',
        description: ''
      })) : [],
      experienceProjects: Array.isArray(cvData.experienceProjects) ? cvData.experienceProjects.map((item: any) => {
        if (item.type === 'project') {
          return {
            type: 'project' as const,
            name: item.name || '',
            description: item.description || '',
            technologies: item.technologies || [],
            url: item.url || '',
            startDate: item.startDate || '',
            endDate: item.endDate || '',
            current: item.current || false,
            bullets: item.bullets || [],
          };
        }
        return {
          type: 'experience' as const,
          company: item.company || '',
          position: item.position || '',
          startDate: item.startDate || '',
          endDate: item.endDate || '',
          current: item.current || false,
          description: item.description || '',
          bullets: item.bullets || [],
        };
      }) : [],
      experience: [],
      projects: [],
      skills: {
        technical: cvData.skills?.technical || [],
        frameworks: cvData.skills?.frameworks || [],
        tools: cvData.skills?.tools || [],
        databases: cvData.skills?.databases || [],
        cloud: cvData.skills?.cloud || [],
        languages: cvData.skills?.languages || ['English', 'Arabic'],
        soft: cvData.skills?.soft || [],
      },
      certifications: cvData.certifications || [],
      achievements: cvData.achievements || [],
      links: cvData.links || {},
      template: 'professional' as const,
      language: 'en' as const,
    };

    // Detect missing required fields
    const missingFields: Array<{ field: string; label: string; required: boolean }> = [];

    if (!normalizedData.fullName || normalizedData.fullName.trim().length < 2) {
      missingFields.push({ field: 'fullName', label: 'Full Name', required: true });
    }
    if (!normalizedData.email || !normalizedData.email.includes('@')) {
      missingFields.push({ field: 'email', label: 'Email Address', required: true });
    }
    if (!normalizedData.phone || normalizedData.phone.replace(/\D/g, '').length < 8) {
      missingFields.push({ field: 'phone', label: 'Phone Number', required: true });
    }
    if (normalizedData.education.length === 0 || !normalizedData.education[0]?.institution) {
      missingFields.push({ field: 'education', label: 'Education (university/degree)', required: true });
    }

    // Calculate extraction stats
    const stats = {
      name: !!normalizedData.fullName,
      email: !!normalizedData.email && normalizedData.email.includes('@'),
      phone: normalizedData.phone.length > 5,
      education: normalizedData.education.length,
      experience: normalizedData.experienceProjects.filter((e: any) => e.type === 'experience').length,
      projects: normalizedData.experienceProjects.filter((e: any) => e.type === 'project').length,
      skills: Object.values(normalizedData.skills).flat().length,
    };

    return NextResponse.json({
      success: true,
      cvData: normalizedData,
      missingFields,
      stats,
      hasAllRequired: missingFields.filter(f => f.required).length === 0,
    });

  } catch (error: any) {
    console.error('[EXTRACT_CV] Error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to extract CV data',
    }, { status: 500 });
  }
}
