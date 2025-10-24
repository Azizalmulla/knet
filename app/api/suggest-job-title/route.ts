import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Lazy initialize OpenAI to avoid build-time errors
function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

interface TitleSuggestion {
  title: string
  reason: string
  level: 'entry' | 'mid' | 'senior' | 'any'
  popularity: string
}

export async function POST(req: NextRequest) {
  try {
    const { description, requirements, responsibilities } = await req.json()

    if (!description || description.length < 20) {
      return NextResponse.json(
        { error: 'Please provide a more detailed job description' },
        { status: 400 }
      )
    }

    // Check if OpenAI is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'AI suggestions not configured' },
        { status: 503 }
      )
    }

    // Combine all available info
    const jobInfo = `
Job Description:
${description}

${requirements ? `Requirements:\n${requirements}` : ''}

${responsibilities ? `Responsibilities:\n${responsibilities}` : ''}
    `.trim()

    const prompt = `Based on this job posting information, suggest 3-5 professional job titles that would be most appropriate.

${jobInfo}

For each title suggestion, provide:
1. The exact job title (standard, professional format)
2. A brief reason why this title fits (one sentence)
3. Experience level this title typically implies (entry/mid/senior/any)
4. How common/popular this title is in the job market

Consider:
- Standard industry terminology
- SEO-friendly titles that candidates actually search for
- Clarity and professionalism
- Typical experience level indicators
- Regional preferences (Kuwait/Middle East)

Return ONLY valid JSON in this exact format (no extra text):
{
  "suggestions": [
    {
      "title": "Social Media Manager",
      "reason": "Best match for managing social media accounts and content creation",
      "level": "mid",
      "popularity": "Very common - used by 1,200+ companies"
    }
  ]
}

Provide 3-5 suggestions, ordered from best to least preferred.`

    const openai = getOpenAI()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a professional HR consultant specializing in job title optimization. Always return valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 600,
    })

    const content = response.choices[0].message.content
    if (!content) {
      throw new Error('No response from AI')
    }

    // Parse JSON response
    let parsed: { suggestions: TitleSuggestion[] }
    try {
      parsed = JSON.parse(content)
    } catch (parseError) {
      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('Invalid JSON response from AI')
      }
    }

    if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
      throw new Error('Invalid suggestions format')
    }

    // Validate and clean suggestions
    const validSuggestions = parsed.suggestions
      .filter(s => s.title && s.reason)
      .slice(0, 5) // Max 5 suggestions
      .map(s => ({
        title: s.title.trim(),
        reason: s.reason.trim(),
        level: s.level || 'any',
        popularity: s.popularity || 'Common in the market'
      }))

    if (validSuggestions.length === 0) {
      throw new Error('No valid suggestions generated')
    }

    return NextResponse.json({
      suggestions: validSuggestions,
      count: validSuggestions.length
    })

  } catch (error: any) {
    console.error('Error generating job title suggestions:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to generate suggestions',
        details: error.message 
      },
      { status: 500 }
    )
  }
}
