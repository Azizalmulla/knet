import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { sql } from '@vercel/postgres';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Upload video response and trigger AI analysis
export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const sessionId = params.sessionId;
    const formData = await request.formData();
    
    const videoFile = formData.get('video') as File;
    const questionId = formData.get('questionId') as string;
    const duration = parseInt(formData.get('duration') as string);

    if (!videoFile || !questionId) {
      return NextResponse.json(
        { error: 'Missing video or questionId' },
        { status: 400 }
      );
    }

    // Verify session exists and is valid
    const sessionResult = await sql`
      SELECT s.id, s.org_id, s.candidate_id, q.question_text
      FROM interview_sessions s
      JOIN interview_questions q ON q.id = ${questionId}::uuid
      WHERE s.id = ${sessionId}::uuid
        AND s.status IN ('pending', 'in_progress')
        AND s.expires_at > now()
      LIMIT 1
    `;

    if (!sessionResult.rows.length) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 404 }
      );
    }

    const session = sessionResult.rows[0];

    // Upload video to Vercel Blob
    console.log('[INTERVIEW] Uploading video to blob storage...');
    const filename = `interviews/${sessionId}/${questionId}-${Date.now()}.webm`;
    const blob = await put(filename, videoFile, {
      access: 'public',
      addRandomSuffix: false,
    });

    console.log('[INTERVIEW] Video uploaded:', blob.url);

    // Save response record
    const responseResult = await sql`
      INSERT INTO interview_responses (
        session_id,
        question_id,
        video_blob_key,
        video_duration_seconds,
        recorded_at
      ) VALUES (
        ${sessionId}::uuid,
        ${questionId}::uuid,
        ${blob.url},
        ${duration},
        now()
      )
      ON CONFLICT (session_id, question_id)
      DO UPDATE SET
        video_blob_key = ${blob.url},
        video_duration_seconds = ${duration},
        recorded_at = now()
      RETURNING id::text
    `;

    const responseId = responseResult.rows[0].id;

    // Update session status
    await sql`
      UPDATE interview_sessions
      SET status = 'in_progress'
      WHERE id = ${sessionId}::uuid
        AND status = 'pending'
    `;

    // Start AI analysis asynchronously (don't wait)
    analyzeVideoResponse(responseId, blob.url, session.question_text)
      .catch(err => console.error('[INTERVIEW] Analysis failed:', err));

    return NextResponse.json({
      success: true,
      responseId,
      videoUrl: blob.url,
      message: 'Video uploaded. AI analysis in progress...'
    });

  } catch (error) {
    console.error('[INTERVIEW] Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload video' },
      { status: 500 }
    );
  }
}

// AI Analysis Function (runs asynchronously)
async function analyzeVideoResponse(
  responseId: string,
  videoUrl: string,
  questionText: string
) {
  try {
    console.log('[INTERVIEW_AI] Starting analysis for:', responseId);

    // Step 1: Download video for transcription
    const videoResponse = await fetch(videoUrl);
    const videoBuffer = await videoResponse.arrayBuffer();
    const videoBlob = new Blob([videoBuffer], { type: 'video/webm' });
    
    // Convert to File object for Whisper API
    const videoFile = new File([videoBlob], 'interview.webm', { type: 'video/webm' });

    // Step 2: Transcribe with Whisper
    console.log('[INTERVIEW_AI] Transcribing audio...');
    const transcription = await openai.audio.transcriptions.create({
      file: videoFile,
      model: 'whisper-1',
      language: 'en', // Auto-detect or specify
      response_format: 'verbose_json',
    });

    const transcript = transcription.text;
    const detectedLanguage = (transcription as any).language || 'en';

    console.log('[INTERVIEW_AI] Transcript:', transcript.substring(0, 200));

    // Step 3: Analyze with GPT-4
    console.log('[INTERVIEW_AI] Analyzing response...');
    const analysisPrompt = `You are an expert interview analyst. Analyze this candidate's video interview response.

Question: ${questionText}

Candidate's Answer (Transcribed): ${transcript}

Provide a comprehensive analysis in JSON format with these fields:
{
  "overall_score": <0-100>,
  "content_quality_score": <0-100>,
  "communication_score": <0-100>,
  "technical_score": <0-100>,
  "ai_reasoning": "<detailed explanation of scores>",
  "key_strengths": ["<strength 1>", "<strength 2>", ...],
  "key_concerns": ["<concern 1>", "<concern 2>", ...],
  "sentiment": "<positive|neutral|negative>"
}

Scoring Guide:
- overall_score: Holistic assessment of the answer
- content_quality_score: How well they answered the question (relevance, depth, examples)
- communication_score: Clarity, structure, confidence, articulation
- technical_score: Technical accuracy and depth (if applicable, otherwise match content_quality_score)

Be fair but thorough. Highlight both strengths and areas for improvement.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert interview analyst. Provide fair, unbiased, and constructive feedback.' },
        { role: 'user', content: analysisPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 1000,
    });

    const analysis = JSON.parse(completion.choices[0].message.content || '{}');

    console.log('[INTERVIEW_AI] Analysis complete:', analysis.overall_score);

    // Step 4: Save transcript and analysis
    await sql`
      UPDATE interview_responses
      SET transcript = ${transcript}
      WHERE id = ${responseId}::uuid
    `;

    await sql`
      INSERT INTO interview_analysis (
        response_id,
        overall_score,
        content_quality_score,
        communication_score,
        technical_score,
        ai_reasoning,
        key_strengths,
        key_concerns,
        detected_language,
        sentiment,
        analyzed_at
      ) VALUES (
        ${responseId}::uuid,
        ${analysis.overall_score},
        ${analysis.content_quality_score},
        ${analysis.communication_score},
        ${analysis.technical_score},
        ${analysis.ai_reasoning},
        ${JSON.stringify(analysis.key_strengths)},
        ${JSON.stringify(analysis.key_concerns)},
        ${detectedLanguage},
        ${analysis.sentiment},
        now()
      )
      ON CONFLICT (response_id)
      DO UPDATE SET
        overall_score = ${analysis.overall_score},
        content_quality_score = ${analysis.content_quality_score},
        communication_score = ${analysis.communication_score},
        technical_score = ${analysis.technical_score},
        ai_reasoning = ${analysis.ai_reasoning},
        key_strengths = ${JSON.stringify(analysis.key_strengths)},
        key_concerns = ${JSON.stringify(analysis.key_concerns)},
        detected_language = ${detectedLanguage},
        sentiment = ${analysis.sentiment},
        analyzed_at = now()
    `;

    console.log('[INTERVIEW_AI] ✅ Analysis saved successfully');

  } catch (error) {
    console.error('[INTERVIEW_AI] ❌ Analysis failed:', error);
    // Don't throw - allow the upload to succeed even if analysis fails
  }
}
