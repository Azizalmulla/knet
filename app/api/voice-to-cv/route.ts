import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds for long audio

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

/**
 * POST /api/voice-to-cv
 * 
 * Converts voice recording to structured CV data
 * 
 * Steps:
 * 1. Receive audio file
 * 2. Transcribe with Whisper
 * 3. Parse with GPT-4 into CV schema
 * 4. Return structured CV data (same format as CV builder)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!openai) {
      return NextResponse.json({ 
        error: 'OpenAI not configured',
        details: 'OPENAI_API_KEY is missing' 
      }, { status: 500 });
    }

    // Get form data (audio file)
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const language = formData.get('language') as string || 'auto'; // 'en', 'ar', or 'auto'

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Validate file type
    const validTypes = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg'];
    if (!validTypes.includes(audioFile.type)) {
      return NextResponse.json({ 
        error: 'Invalid audio format',
        details: `Supported formats: ${validTypes.join(', ')}`
      }, { status: 400 });
    }

    // Step 1: Transcribe audio with Whisper
    console.log('[Voice-to-CV] Transcribing audio...', {
      filename: audioFile.name,
      size: audioFile.size,
      type: audioFile.type,
    });

    let transcript = '';
    try {
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: language === 'auto' ? undefined : language,
        response_format: 'verbose_json',
      });

      transcript = transcription.text;
      
      if (!transcript || transcript.trim().length < 50) {
        return NextResponse.json({
          error: 'Audio too short or unclear',
          details: 'Please speak for at least 30 seconds with clear audio'
        }, { status: 400 });
      }

      console.log('[Voice-to-CV] Transcription successful', {
        length: transcript.length,
        detected_language: (transcription as any).language,
      });
    } catch (transcriptionError: any) {
      console.error('[Voice-to-CV] Transcription error:', transcriptionError);
      return NextResponse.json({
        error: 'Failed to transcribe audio',
        details: transcriptionError.message || 'Please try recording again'
      }, { status: 500 });
    }

    // Step 2: Parse transcript into structured CV data with GPT-4
    console.log('[Voice-to-CV] Parsing transcript into CV data...');

    const systemPrompt = `You are a professional CV parser. Extract structured CV information from voice transcripts.

OUTPUT REQUIREMENTS:
- Return ONLY valid JSON, no markdown or explanations
- Follow the exact schema provided
- Extract ALL mentioned information
- For dates, use format: "MM/YYYY" or "YYYY"
- For ongoing roles/education: leave endDate empty and set current/currentlyStudying to true
- Default phone to "+965 " if not mentioned
- Default location to "Kuwait" if not mentioned
- Extract skills into technical, languages, and soft categories
- For experienceProjects: mark type as "experience" or "project"
- Be generous with bullet points - extract all achievements/responsibilities mentioned

SCHEMA:
{
  "fullName": string (required),
  "email": string (required),
  "phone": string (default: "+965 "),
  "location": string (default: "Kuwait"),
  "summary": string (optional, 2-3 sentences),
  "education": [
    {
      "institution": string,
      "degree": string,
      "fieldOfStudy": string,
      "startDate": string,
      "endDate": string (optional),
      "currentlyStudying": boolean,
      "gpa": string (optional),
      "description": string (optional)
    }
  ],
  "experienceProjects": [
    {
      "type": "experience" | "project",
      "company": string (for experience),
      "position": string (for experience),
      "name": string (for project),
      "description": string,
      "startDate": string (optional),
      "endDate": string (optional),
      "current": boolean,
      "bullets": string[] (extract achievements/responsibilities),
      "technologies": string[] (for projects)
    }
  ],
  "skills": {
    "technical": string[] (programming, tools, frameworks),
    "languages": string[] (English, Arabic, etc.),
    "soft": string[] (leadership, communication, etc.)
  },
  "links": {
    "linkedin": string (optional),
    "github": string (optional),
    "portfolio": string (optional)
  },
  "language": "en" | "ar" (detected from transcript)
}

IMPORTANT:
- If information is missing, use reasonable defaults
- Extract bullet points from achievements, projects, responsibilities
- Organize information clearly
- Ensure all required fields have values`;

    const userPrompt = `Parse this voice transcript into a structured CV:

Transcript:
"""
${transcript}
"""

Return the CV data as JSON matching the schema exactly.`;

    let cvData: any;
    try {
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

      const rawResponse = completion.choices[0]?.message?.content;
      if (!rawResponse) {
        throw new Error('Empty response from GPT-4');
      }

      cvData = JSON.parse(rawResponse);
      
      // Validate required fields
      if (!cvData.fullName || !cvData.email) {
        return NextResponse.json({
          error: 'Missing required information',
          details: 'Please mention your full name and email address in your recording',
          transcript, // Return transcript so user can see what was heard
        }, { status: 400 });
      }

      console.log('[Voice-to-CV] CV data parsed successfully', {
        name: cvData.fullName,
        email: cvData.email,
        educationCount: cvData.education?.length || 0,
        experienceProjectsCount: cvData.experienceProjects?.length || 0,
        skillsCount: Object.values(cvData.skills || {}).flat().length,
      });

    } catch (parsingError: any) {
      console.error('[Voice-to-CV] Parsing error:', parsingError);
      return NextResponse.json({
        error: 'Failed to parse transcript',
        details: parsingError.message || 'Could not extract CV data from audio',
        transcript, // Return transcript for debugging
      }, { status: 500 });
    }

    // Step 3: Ensure data matches CV builder schema exactly
    const normalizedCvData = {
      fullName: cvData.fullName || '',
      email: cvData.email || '',
      phone: cvData.phone || '+965 ',
      location: cvData.location || 'Kuwait',
      summary: cvData.summary || '',
      education: (cvData.education || []).map((edu: any) => ({
        institution: edu.institution || '',
        degree: edu.degree || '',
        fieldOfStudy: edu.fieldOfStudy || '',
        startDate: edu.startDate || '',
        endDate: edu.endDate || '',
        currentlyStudying: edu.currentlyStudying || false,
        gpa: edu.gpa || '',
        description: edu.description || '',
      })),
      experienceProjects: (cvData.experienceProjects || []).map((item: any) => {
        if (item.type === 'experience') {
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
        } else {
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
      }),
      experience: [], // Legacy field
      projects: [], // Legacy field
      skills: {
        technical: cvData.skills?.technical || [],
        languages: cvData.skills?.languages || ['English'],
        soft: cvData.skills?.soft || [],
      },
      links: cvData.links || {},
      template: 'professional' as const,
      language: (cvData.language || 'en') as 'en' | 'ar',
    };

    // Return success with CV data + transcript
    return NextResponse.json({
      success: true,
      cvData: normalizedCvData,
      transcript, // Include for user review/editing
      metadata: {
        transcriptionLanguage: (cvData.language || 'en'),
        processingTime: Date.now(),
        itemsExtracted: {
          education: normalizedCvData.education.length,
          experienceProjects: normalizedCvData.experienceProjects.length,
          skills: Object.values(normalizedCvData.skills).flat().length,
        },
      },
    });

  } catch (error: any) {
    console.error('[Voice-to-CV] Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message || 'An unexpected error occurred',
    }, { status: 500 });
  }
}
