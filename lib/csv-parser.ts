/**
 * CSV parsing utilities for bulk candidate import
 * Supports flexible column mapping and validation
 */

export interface CandidateCSVRow {
  email: string
  full_name: string
  phone?: string
  field_of_study?: string
  area_of_interest?: string
  gpa?: number | string
  degree?: string
  years_of_experience?: string
  cv_filename?: string // Optional: filename to match with ZIP
}

export interface CSVParseResult {
  success: boolean
  rows: CandidateCSVRow[]
  errors: string[]
  warnings: string[]
  totalRows: number
  validRows: number
}

/**
 * Parse CSV text into candidate rows
 * Handles common CSV formats and column name variations
 */
export function parseCSV(csvText: string): CSVParseResult {
  const result: CSVParseResult = {
    success: false,
    rows: [],
    errors: [],
    warnings: [],
    totalRows: 0,
    validRows: 0
  }

  try {
    // Split into lines and remove empty lines
    const lines = csvText
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0)

    if (lines.length < 2) {
      result.errors.push('CSV file must have at least a header row and one data row')
      return result
    }

    // Parse header
    const headerLine = lines[0]
    const headers = parseCSVLine(headerLine).map(h => h.toLowerCase().trim())

    // Map common column name variations to our standard fields
    const columnMap = createColumnMap(headers)

    if (!columnMap.email && !columnMap.full_name) {
      result.errors.push('CSV must have at least "email" or "full_name" column')
      return result
    }

    // Parse data rows
    result.totalRows = lines.length - 1

    for (let i = 1; i < lines.length; i++) {
      const lineNum = i + 1
      const values = parseCSVLine(lines[i])

      if (values.length === 0) continue

      const row = mapRowToCandidate(values, columnMap, headers)

      // Validate required fields
      if (!row.email && !row.full_name) {
        result.warnings.push(`Row ${lineNum}: Missing both email and name, skipping`)
        continue
      }

      // Basic email validation
      if (row.email && !isValidEmail(row.email)) {
        result.warnings.push(`Row ${lineNum}: Invalid email "${row.email}"`)
      }

      // Convert GPA to number if possible
      if (row.gpa && typeof row.gpa === 'string') {
        const gpaNum = parseFloat(row.gpa)
        if (!isNaN(gpaNum) && gpaNum >= 0 && gpaNum <= 5) {
          row.gpa = gpaNum
        } else {
          row.gpa = undefined
          result.warnings.push(`Row ${lineNum}: Invalid GPA "${row.gpa}", setting to null`)
        }
      }

      result.rows.push(row)
      result.validRows++
    }

    if (result.validRows === 0) {
      result.errors.push('No valid rows found in CSV')
      return result
    }

    result.success = true
    return result

  } catch (error: any) {
    result.errors.push(`CSV parsing failed: ${error.message}`)
    return result
  }
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"'
        i++ // Skip next quote
      } else {
        // Toggle quotes
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  // Add last field
  values.push(current.trim())

  return values
}

/**
 * Create column mapping from header names
 */
function createColumnMap(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {}

  headers.forEach((header, index) => {
    // Email
    if (['email', 'e-mail', 'email address', 'contact email'].includes(header)) {
      map.email = index
    }
    // Full name
    else if (['full_name', 'fullname', 'name', 'full name', 'candidate name'].includes(header)) {
      map.full_name = index
    }
    // Phone
    else if (['phone', 'phone number', 'mobile', 'contact number', 'telephone'].includes(header)) {
      map.phone = index
    }
    // Field of study
    else if (['field_of_study', 'field of study', 'major', 'field', 'degree field', 'study field'].includes(header)) {
      map.field_of_study = index
    }
    // Area of interest
    else if (['area_of_interest', 'area of interest', 'interest', 'career interest', 'desired role'].includes(header)) {
      map.area_of_interest = index
    }
    // GPA
    else if (['gpa', 'grade', 'average', 'cgpa', 'grade point average'].includes(header)) {
      map.gpa = index
    }
    // Degree
    else if (['degree', 'degree type', 'qualification', 'education level'].includes(header)) {
      map.degree = index
    }
    // Years of experience
    else if (['years_of_experience', 'years of experience', 'experience', 'yoe', 'work experience'].includes(header)) {
      map.years_of_experience = index
    }
    // CV filename
    else if (['cv_filename', 'cv filename', 'filename', 'cv file', 'resume filename'].includes(header)) {
      map.cv_filename = index
    }
  })

  return map
}

/**
 * Map CSV row values to candidate object
 */
function mapRowToCandidate(
  values: string[],
  columnMap: Record<string, number>,
  headers: string[]
): CandidateCSVRow {
  const row: CandidateCSVRow = {
    email: '',
    full_name: ''
  }

  if (columnMap.email !== undefined) {
    row.email = values[columnMap.email] || ''
  }
  if (columnMap.full_name !== undefined) {
    row.full_name = values[columnMap.full_name] || ''
  }
  if (columnMap.phone !== undefined) {
    row.phone = values[columnMap.phone] || undefined
  }
  if (columnMap.field_of_study !== undefined) {
    row.field_of_study = values[columnMap.field_of_study] || undefined
  }
  if (columnMap.area_of_interest !== undefined) {
    row.area_of_interest = values[columnMap.area_of_interest] || undefined
  }
  if (columnMap.gpa !== undefined) {
    row.gpa = values[columnMap.gpa] || undefined
  }
  if (columnMap.degree !== undefined) {
    row.degree = values[columnMap.degree] || undefined
  }
  if (columnMap.years_of_experience !== undefined) {
    row.years_of_experience = values[columnMap.years_of_experience] || undefined
  }
  if (columnMap.cv_filename !== undefined) {
    row.cv_filename = values[columnMap.cv_filename] || undefined
  }

  return row
}

/**
 * Basic email validation
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Generate sample CSV for download
 */
export function generateSampleCSV(): string {
  const headers = [
    'email',
    'full_name',
    'phone',
    'field_of_study',
    'area_of_interest',
    'gpa',
    'degree',
    'years_of_experience',
    'cv_filename'
  ]

  const sampleRows = [
    [
      'john.doe@example.com',
      'John Doe',
      '+965 12345678',
      'Computer Science',
      'Software Development',
      '3.8',
      "Bachelor's",
      '4-5',
      'john-doe.pdf'
    ],
    [
      'jane.smith@example.com',
      'Jane Smith',
      '+965 87654321',
      'Business Administration',
      'Marketing',
      '3.5',
      "Master's",
      '6+',
      'jane-smith.pdf'
    ],
    [
      'ahmad.ali@example.com',
      'Ahmad Ali',
      '+965 55566677',
      'Engineering',
      'Project Management',
      '3.9',
      "Bachelor's",
      '0-1',
      'ahmad-ali.pdf'
    ]
  ]

  return [
    headers.join(','),
    ...sampleRows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')
}
