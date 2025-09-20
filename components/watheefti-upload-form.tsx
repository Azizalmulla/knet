"use client"

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useLanguage } from '@/lib/language'
import { toast } from 'sonner'
import { 
  Upload, X, FileText, User, Mail, Phone, 
  GraduationCap, Briefcase, Target, Calendar, Hash
} from 'lucide-react'
import { 
  FIELD_OF_STUDY_OPTIONS, 
  AREA_OF_INTEREST_OPTIONS,
  DEGREE_OPTIONS,
  YEARS_OF_EXPERIENCE_OPTIONS,
  normalizePhoneNumber,
  validateGPA,
  formatGPA,
  getFieldLabel
} from '@/lib/watheefti-fields'

interface WatheeftiUploadFormProps {
  orgSlug: string
}

export default function WatheeftiUploadForm({ orgSlug }: WatheeftiUploadFormProps) {
  const router = useRouter()
  const { t, language } = useLanguage()
  const isRTL = language === 'ar'
  
  // Form fields
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [fieldOfStudy, setFieldOfStudy] = useState('')
  const [fieldOfStudyOther, setFieldOfStudyOther] = useState('')
  const [areaOfInterest, setAreaOfInterest] = useState('')
  const [degree, setDegree] = useState('')
  const [yearsOfExperience, setYearsOfExperience] = useState('')
  const [gpa, setGPA] = useState('')
  
  // CV Upload
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [cvBlobKey, setCvBlobKey] = useState('')
  
  // UI State
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    // Required field validation
    if (!fullName.trim()) newErrors.fullName = t('name_required') || 'Full name is required'
    if (!email.trim()) newErrors.email = t('email_required') || 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = t('email_invalid') || 'Invalid email format'
    }
    
    if (!phone.trim()) newErrors.phone = t('phone_required') || 'Phone is required'
    else if (phone.replace(/\D/g, '').length < 8) {
      newErrors.phone = t('phone_invalid') || 'Phone must be at least 8 digits'
    }
    
    if (!fieldOfStudy) newErrors.fieldOfStudy = t('field_required') || 'Field of study is required'
    if (fieldOfStudy === 'others' && !fieldOfStudyOther.trim()) {
      newErrors.fieldOfStudyOther = t('specify_field') || 'Please specify your field of study'
    }
    
    if (!areaOfInterest) newErrors.areaOfInterest = t('area_required') || 'Area of interest is required'
    if (!degree) newErrors.degree = t('degree_required') || 'Degree is required'
    if (!yearsOfExperience) newErrors.yearsOfExperience = t('experience_required') || 'Years of experience is required'
    
    // GPA validation (optional but must be valid if provided)
    if (gpa && !validateGPA(gpa)) {
      newErrors.gpa = t('gpa_invalid') || 'GPA must be between 0.00 and 4.00'
    }
    
    // CV validation
    if (!cvFile && !cvBlobKey) {
      newErrors.cv = t('cv_required') || 'Please upload your CV'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }
  
  const handleCvUpload = useCallback(async (file: File) => {
    // Validate file
    if (file.type !== 'application/pdf') {
      toast.error(t('cv_pdf_only') || 'Only PDF files are allowed')
      return
    }
    
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('cv_size_limit') || 'File size must be less than 10MB')
      return
    }
    
    setCvFile(file)
    setUploadProgress(0)
    
    try {
      // Upload to blob storage with org prefix
      const formData = new FormData()
      formData.append('file', file)
      formData.append('orgSlug', orgSlug)
      
      const response = await fetch('/api/upload-cv', {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) {
        throw new Error('Upload failed')
      }
      
      const { blobKey, url } = await response.json()
      setCvBlobKey(blobKey)
      setUploadProgress(100)
      toast.success(t('cv_uploaded') || 'CV uploaded successfully')
    } catch (error) {
      toast.error(t('upload_failed') || 'Failed to upload CV')
      setCvFile(null)
      setUploadProgress(0)
    }
  }, [orgSlug, t])
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      toast.error(t('fix_errors') || 'Please fix the errors before submitting')
      return
    }
    
    setLoading(true)
    
    try {
      // Upload CV if not already uploaded
      if (cvFile && !cvBlobKey) {
        await handleCvUpload(cvFile)
      }
      
      const payload = {
        orgSlug,
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: normalizePhoneNumber(phone),
        fieldOfStudy,
        fieldOfStudyOther: fieldOfStudy === 'others' ? fieldOfStudyOther.trim() : null,
        areaOfInterest,
        degree,
        yearsOfExperience,
        gpa: gpa ? formatGPA(gpa) : null,
        cvBlobKey,
        cvType: 'uploaded',
        language
      }
      
      const response = await fetch(`/api/${orgSlug}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Submission failed')
      }
      
      // Set success cookie
      document.cookie = `submission_success=true; path=/; max-age=60`
      
      // Redirect to success page
      router.push(`/${orgSlug}/success?id=${data.candidateId}`)
      
    } catch (error: any) {
      console.error('Submission error:', error)
      toast.error(error.message || t('submission_failed') || 'Failed to submit application')
    } finally {
      setLoading(false)
    }
  }
  
  const removeCv = () => {
    setCvFile(null)
    setCvBlobKey('')
    setUploadProgress(0)
  }
  
  return (
    <Card className="w-full max-w-3xl mx-auto" dir={isRTL ? 'rtl' : 'ltr'}>
      <CardHeader>
        <CardTitle className="text-2xl">
          {t('application_form') || 'Job Application Form'}
        </CardTitle>
        <CardDescription>
          {t('fill_required') || 'Please fill in all required fields'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <User className="h-5 w-5" />
              {t('personal_info') || 'Personal Information'}
            </h3>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="fullName">
                  {t('full_name') || 'Full Name'} *
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t('enter_full_name') || 'Enter your full name'}
                  disabled={loading}
                  className={errors.fullName ? 'border-destructive' : ''}
                />
                {errors.fullName && (
                  <p className="text-sm text-destructive mt-1">{errors.fullName}</p>
                )}
              </div>
              
              <div>
                <Label htmlFor="email">
                  {t('email') || 'Email'} *
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  disabled={loading}
                  dir="ltr"
                  className={errors.email ? 'border-destructive' : ''}
                />
                {errors.email && (
                  <p className="text-sm text-destructive mt-1">{errors.email}</p>
                )}
              </div>
            </div>
            
            <div>
              <Label htmlFor="phone">
                {t('phone') || 'Phone Number'} *
              </Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+965 9999 9999"
                disabled={loading}
                dir="ltr"
                className={errors.phone ? 'border-destructive' : ''}
              />
              {errors.phone && (
                <p className="text-sm text-destructive mt-1">{errors.phone}</p>
              )}
            </div>
          </div>
          
          {/* Education & Experience */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              {t('education_experience') || 'Education & Experience'}
            </h3>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="degree">
                  {t('degree') || 'Degree'} *
                </Label>
                <Select value={degree} onValueChange={setDegree} disabled={loading}>
                  <SelectTrigger className={errors.degree ? 'border-destructive' : ''}>
                    <SelectValue placeholder={t('select_degree') || 'Select degree'} />
                  </SelectTrigger>
                  <SelectContent>
                    {DEGREE_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {getFieldLabel(option.value, DEGREE_OPTIONS, language as 'en' | 'ar')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.degree && (
                  <p className="text-sm text-destructive mt-1">{errors.degree}</p>
                )}
              </div>
              
              <div>
                <Label htmlFor="yearsOfExperience">
                  {t('years_experience') || 'Years of Experience'} *
                </Label>
                <Select value={yearsOfExperience} onValueChange={setYearsOfExperience} disabled={loading}>
                  <SelectTrigger className={errors.yearsOfExperience ? 'border-destructive' : ''}>
                    <SelectValue placeholder={t('select_experience') || 'Select experience'} />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS_OF_EXPERIENCE_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {getFieldLabel(option.value, YEARS_OF_EXPERIENCE_OPTIONS, language as 'en' | 'ar')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.yearsOfExperience && (
                  <p className="text-sm text-destructive mt-1">{errors.yearsOfExperience}</p>
                )}
              </div>
            </div>
            
            <div>
              <Label htmlFor="fieldOfStudy">
                {t('field_of_study') || 'Field of Study'} *
              </Label>
              <Select value={fieldOfStudy} onValueChange={setFieldOfStudy} disabled={loading}>
                <SelectTrigger className={errors.fieldOfStudy ? 'border-destructive' : ''}>
                  <SelectValue placeholder={t('select_field') || 'Select field of study'} />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_OF_STUDY_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {getFieldLabel(option.value, FIELD_OF_STUDY_OPTIONS, language as 'en' | 'ar')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.fieldOfStudy && (
                <p className="text-sm text-destructive mt-1">{errors.fieldOfStudy}</p>
              )}
            </div>
            
            {/* Show text input when "Others" is selected */}
            {fieldOfStudy === 'others' && (
              <div>
                <Label htmlFor="fieldOfStudyOther">
                  {t('specify_field') || 'Please specify your field of study'} *
                </Label>
                <Input
                  id="fieldOfStudyOther"
                  type="text"
                  value={fieldOfStudyOther}
                  onChange={(e) => setFieldOfStudyOther(e.target.value)}
                  placeholder={t('enter_field') || 'Enter your field of study'}
                  disabled={loading}
                  className={errors.fieldOfStudyOther ? 'border-destructive' : ''}
                />
                {errors.fieldOfStudyOther && (
                  <p className="text-sm text-destructive mt-1">{errors.fieldOfStudyOther}</p>
                )}
              </div>
            )}
            
            <div>
              <Label htmlFor="areaOfInterest">
                {t('area_of_interest') || 'Area of Interest'} *
              </Label>
              <Select value={areaOfInterest} onValueChange={setAreaOfInterest} disabled={loading}>
                <SelectTrigger className={errors.areaOfInterest ? 'border-destructive' : ''}>
                  <SelectValue placeholder={t('select_area') || 'Select area of interest'} />
                </SelectTrigger>
                <SelectContent>
                  {AREA_OF_INTEREST_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {getFieldLabel(option.value, AREA_OF_INTEREST_OPTIONS, language as 'en' | 'ar')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.areaOfInterest && (
                <p className="text-sm text-destructive mt-1">{errors.areaOfInterest}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="gpa">
                {t('gpa') || 'GPA'} ({t('optional') || 'Optional'})
              </Label>
              <Input
                id="gpa"
                type="text"
                value={gpa}
                onChange={(e) => setGPA(e.target.value)}
                placeholder="0.00 - 4.00"
                disabled={loading}
                dir="ltr"
                className={errors.gpa ? 'border-destructive' : ''}
              />
              {errors.gpa && (
                <p className="text-sm text-destructive mt-1">{errors.gpa}</p>
              )}
            </div>
          </div>
          
          {/* CV Upload */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t('cv_upload') || 'CV Upload'} *
            </h3>
            
            {!cvFile ? (
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <Label htmlFor="cv-upload" className="cursor-pointer">
                  <span className="text-primary underline">
                    {t('click_upload') || 'Click to upload'}
                  </span>
                  {' '}{t('or_drag') || 'or drag and drop'}
                </Label>
                <Input
                  id="cv-upload"
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleCvUpload(file)
                  }}
                  className="hidden"
                  disabled={loading}
                />
                <p className="text-sm text-muted-foreground mt-2">
                  {t('pdf_only') || 'PDF only, max 10MB'}
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium">{cvFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(cvFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={removeCv}
                  disabled={loading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
            
            {errors.cv && (
              <Alert className="border-destructive">
                <AlertDescription className="text-destructive">
                  {errors.cv}
                </AlertDescription>
              </Alert>
            )}
          </div>
          
          {/* Submit Button */}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                {t('submitting') || 'Submitting...'}
              </>
            ) : (
              <>
                {t('submit_application') || 'Submit Application'}
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
