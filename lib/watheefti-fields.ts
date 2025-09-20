// Watheefti-compliant field definitions for Kuwait job market

export const FIELD_OF_STUDY_OPTIONS = [
  { value: 'computer_science', label_en: 'Computer Science', label_ar: 'علوم الحاسوب' },
  { value: 'information_technology', label_en: 'Information Technology', label_ar: 'تقنية المعلومات' },
  { value: 'business_administration', label_en: 'Business Administration', label_ar: 'إدارة الأعمال' },
  { value: 'engineering', label_en: 'Engineering', label_ar: 'الهندسة' },
  { value: 'finance', label_en: 'Finance', label_ar: 'المالية' },
  { value: 'marketing', label_en: 'Marketing', label_ar: 'التسويق' },
  { value: 'human_resources', label_en: 'Human Resources', label_ar: 'الموارد البشرية' },
  { value: 'law', label_en: 'Law', label_ar: 'القانون' },
  { value: 'medicine', label_en: 'Medicine', label_ar: 'الطب' },
  { value: 'accounting', label_en: 'Accounting', label_ar: 'المحاسبة' },
  { value: 'economics', label_en: 'Economics', label_ar: 'الاقتصاد' },
  { value: 'education', label_en: 'Education', label_ar: 'التعليم' },
  { value: 'others', label_en: 'Others', label_ar: 'أخرى' }
] as const

export const AREA_OF_INTEREST_OPTIONS = [
  { value: 'software_development', label_en: 'Software Development', label_ar: 'تطوير البرمجيات' },
  { value: 'data_science', label_en: 'Data Science', label_ar: 'علوم البيانات' },
  { value: 'cybersecurity', label_en: 'Cybersecurity', label_ar: 'الأمن السيبراني' },
  { value: 'cloud_computing', label_en: 'Cloud Computing', label_ar: 'الحوسبة السحابية' },
  { value: 'project_management', label_en: 'Project Management', label_ar: 'إدارة المشاريع' },
  { value: 'sales', label_en: 'Sales', label_ar: 'المبيعات' },
  { value: 'customer_service', label_en: 'Customer Service', label_ar: 'خدمة العملاء' },
  { value: 'operations', label_en: 'Operations', label_ar: 'العمليات' },
  { value: 'research', label_en: 'Research', label_ar: 'البحث' },
  { value: 'consulting', label_en: 'Consulting', label_ar: 'الاستشارات' },
  { value: 'banking', label_en: 'Banking', label_ar: 'البنوك' },
  { value: 'investment', label_en: 'Investment', label_ar: 'الاستثمار' }
] as const

export const DEGREE_OPTIONS = [
  { value: 'high_school', label_en: 'High School', label_ar: 'الثانوية العامة' },
  { value: 'diploma', label_en: 'Diploma', label_ar: 'دبلوم' },
  { value: 'bachelor', label_en: 'Bachelor', label_ar: 'بكالوريوس' },
  { value: 'master', label_en: 'Master', label_ar: 'ماجستير' },
  { value: 'phd', label_en: 'PhD', label_ar: 'دكتوراه' }
] as const

export const YEARS_OF_EXPERIENCE_OPTIONS = [
  { value: '0-1', label_en: '0-1 years', label_ar: '0-1 سنة' },
  { value: '2-3', label_en: '2-3 years', label_ar: '2-3 سنوات' },
  { value: '4-5', label_en: '4-5 years', label_ar: '4-5 سنوات' },
  { value: '6+', label_en: '6+ years', label_ar: '6+ سنوات' }
] as const

// Type definitions
export type FieldOfStudy = typeof FIELD_OF_STUDY_OPTIONS[number]['value']
export type AreaOfInterest = typeof AREA_OF_INTEREST_OPTIONS[number]['value']
export type Degree = typeof DEGREE_OPTIONS[number]['value']
export type YearsOfExperience = typeof YEARS_OF_EXPERIENCE_OPTIONS[number]['value']

// Helper functions
export function getFieldLabel(
  value: string, 
  options: readonly any[], 
  lang: 'en' | 'ar' = 'en'
): string {
  const option = options.find(opt => opt.value === value)
  if (!option) return value
  return lang === 'ar' ? option.label_ar : option.label_en
}

export function normalizePhoneNumber(phone: string): string {
  // Remove all non-numeric characters
  let normalized = phone.replace(/\D/g, '')
  
  // Handle Arabic numerals (٠١٢٣٤٥٦٧٨٩)
  const arabicNumerals = '٠١٢٣٤٥٦٧٨٩'
  const englishNumerals = '0123456789'
  
  for (let i = 0; i < arabicNumerals.length; i++) {
    normalized = normalized.replace(new RegExp(arabicNumerals[i], 'g'), englishNumerals[i])
  }
  
  // Add Kuwait country code if missing
  if (normalized.length === 8 && !normalized.startsWith('965')) {
    normalized = '965' + normalized
  }
  
  return '+' + normalized
}

export function validateGPA(gpa: string): boolean {
  // Accept both English and Arabic numerals
  const normalized = gpa.replace(/[٠-٩]/g, (match) => {
    return String.fromCharCode(match.charCodeAt(0) - 1632 + 48)
  })
  
  const value = parseFloat(normalized)
  return !isNaN(value) && value >= 0 && value <= 4.00
}

export function formatGPA(gpa: string | number): string {
  const value = typeof gpa === 'string' ? parseFloat(gpa) : gpa
  return value.toFixed(2)
}
