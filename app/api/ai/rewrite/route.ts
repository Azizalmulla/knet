import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Error budget monitoring for AI retries
const incrementAIRetryBudget = () => {
  console.error('ALERT:AI_RETRIES', { 
    timestamp: new Date().toISOString(),
    context: 'OpenAI API retry',
    action: 'exponential_backoff'
  });
};

async function callOpenAIWithRetry(openai: OpenAI, prompt: string, retries = 2): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 500,
      });
      return completion;
    } catch (error: any) {
      if (error.status === 429 && attempt < retries) {
        incrementAIRetryBudget();
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    const { rawText, section } = await request.json();

    const prompt = `Transform the following raw notes into professional, ATS-friendly bullet points for a CV ${section} section. Return as JSON array of strings:

Raw notes: ${rawText}

Requirements:
- Use action verbs and quantifiable achievements
- Keep each bullet concise (1-2 lines)
- Make it ATS-friendly with relevant keywords
- Return as JSON array format: ["bullet 1", "bullet 2", ...]`;

    const completion = await callOpenAIWithRetry(openai, prompt);

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content received from OpenAI');
    }

    // Parse the JSON response
    const bullets = JSON.parse(content);
    
    return NextResponse.json({ bullets });
  } catch (error) {
    console.error('OpenAI API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate bullet points' },
      { status: 500 }
    );
  }
}
