/**
 * Email parsing utilities for automatic CV import
 * Extracts candidate information from email body using AI
 */

export interface ParsedCandidateData {
  full_name: string | null
  email: string | null
  phone: string | null
  field_of_study: string | null
  area_of_interest: string | null
  gpa: number | null
  degree: string | null
  years_of_experience: string | null
  raw_text: string
}

/**
 * Extract candidate information from email text using regex + AI
 */
export async function parseEmailForCandidate(emailText: string, senderEmail: string): Promise<ParsedCandidateData> {
  // Clean email text
  const cleanText = emailText
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\r\n/g, '\n')
    .trim()

  // Regex patterns for quick extraction
  const emailRegex = /[\w.-]+@[\w.-]+\.\w{2,}/g
  const phoneRegex = /(?:\+965|00965|965)?\s*\d{8}/g
  const gpaRegex = /\bgpa[:\s]*(\d+\.?\d*)\b/gi

  // Extract using regex first (fast)
  const emails = cleanText.match(emailRegex) || []
  const phones = cleanText.match(phoneRegex) || []
  const gpaMatch = gpaRegex.exec(cleanText)
  const extractedGPA = gpaMatch ? parseFloat(gpaMatch[1]) : null

  // Use sender email as fallback
  const candidateEmail = emails.find(e => e !== senderEmail && !e.includes('wathefni')) || senderEmail

  // Try AI extraction if OpenAI is available
  let aiData: Partial<ParsedCandidateData> | null = null
  
  if (process.env.OPENAI_API_KEY) {
    try {
      aiData = await extractWithAI(cleanText)
    } catch (error) {
      console.error('[EMAIL_PARSER] AI extraction failed:', error)
    }
  }

  // Merge regex + AI results (AI takes precedence if available)
  return {
    full_name: aiData?.full_name || extractNameFromEmail(candidateEmail),
    email: candidateEmail,
    phone: aiData?.phone || phones[0] || null,
    field_of_study: aiData?.field_of_study || null,
    area_of_interest: aiData?.area_of_interest || null,
    gpa: aiData?.gpa ?? extractedGPA,
    degree: aiData?.degree || null,
    years_of_experience: aiData?.years_of_experience || null,
    raw_text: cleanText.substring(0, 5000) // Limit to 5k chars
  }
}

/**
 * Extract candidate data using OpenAI
 */
async function extractWithAI(emailText: string): Promise<Partial<ParsedCandidateData>> {
  const { default: OpenAI } = await import('openai')
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const prompt = `Extract candidate information from this job application email. Return JSON only.

Email:
${emailText.substring(0, 2000)}

Extract these fields (use null if not found):
- full_name: Full name of the applicant
- email: Email address
- phone: Phone number (keep +965 format if present)
- field_of_study: Their field of study or major
- area_of_interest: Career interest or desired role
- gpa: GPA as a number (e.g., 3.5)
- degree: Degree type (e.g., "Bachelor's", "Master's")
- years_of_experience: Years of experience (e.g., "0-2 years", "3-5 years")

Return valid JSON only, no markdown.`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.1
  })

  const content = response.choices[0].message.content || '{}'
  return JSON.parse(content)
}

/**
 * Extract name from email address as fallback
 */
function extractNameFromEmail(email: string): string {
  const localPart = email.split('@')[0]
  // Convert john.doe or john_doe to John Doe
  return localPart
    .replace(/[._-]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Normalize Watheefti taxonomy values
 */
export function normalizeWatheeftiValues(data: ParsedCandidateData): {
  degree: string | null
  yearsOfExperience: string | null
  areaOfInterest: string | null
} {
  // Simple normalization (can be enhanced later)
  const degreeMap: Record<string, string> = {
    'bachelor': "Bachelor's",
    "bachelor's": "Bachelor's",
    'bs': "Bachelor's",
    'master': "Master's",
    "master's": "Master's",
    'ms': "Master's",
    'mba': "Master's",
    'phd': 'PhD',
    'doctorate': 'PhD'
  }

  const yoeMap: Record<string, string> = {
    '0': '0-1',
    '1': '0-1',
    '2': '2-3',
    '3': '2-3',
    '4': '4-5',
    '5': '4-5',
    '6': '6+',
    '7': '6+',
    '8': '6+',
    '9': '6+',
    '10': '6+',
    '0-2': '0-1',
    '0-2 years': '0-1',
    '3-5': '4-5',
    '3-5 years': '4-5',
    '5-10': '6+',
    '5-10 years': '6+',
    '10+': '6+',
    '10+ years': '6+'
  }

  const normalizedDegree = data.degree 
    ? degreeMap[data.degree.toLowerCase()] || data.degree
    : null

  // Normalize years of experience to match database enum: '0-1', '2-3', '4-5', '6+'
  let normalizedYoe: string | null = null
  if (data.years_of_experience) {
    const yoeStr = String(data.years_of_experience).toLowerCase().trim()
    // Try direct map
    normalizedYoe = yoeMap[yoeStr] || null
    // If not found, try extracting first number
    if (!normalizedYoe) {
      const match = yoeStr.match(/(\d+)/)
      if (match) {
        const num = parseInt(match[1], 10)
        normalizedYoe = yoeMap[String(num)] || null
      }
    }
  }

  return {
    degree: normalizedDegree,
    yearsOfExperience: normalizedYoe,
    areaOfInterest: data.area_of_interest
  }
}
