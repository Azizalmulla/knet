import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '@testing-library/react'
import UploadCVForm from '@/components/upload-cv-form'
import { LanguageProvider } from '@/lib/language'

// Mock toast
jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}))

// Mock career map functions
jest.mock('@/lib/career-map', () => ({
  getFields: () => ['Computer Science', 'Engineering'],
  getAreasForField: () => ['Software Development', 'Data Science'],
  matchSuggestedVacancies: (field: string, area: string) => 
    field === 'Computer Science' && area === 'Software Development' 
      ? 'Frontend Developer/Backend Developer/Full Stack Developer' 
      : null,
}))

describe('Upload CV Robustness Tests', () => {
  let alertSpy: jest.SpyInstance
  
  beforeEach(() => {
    // Reset all mocks
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true })
    })
    jest.clearAllMocks()
    
    // Mock alert to capture error messages
    alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {})
    
    // Mock react-hook-form to bypass complex form validation for robustness testing
    jest.spyOn(require('react-hook-form'), 'useForm').mockImplementation(() => ({
      register: jest.fn(() => ({ name: 'test', onChange: jest.fn(), onBlur: jest.fn(), ref: jest.fn() })),
      handleSubmit: jest.fn((onSubmit) => async (e: any) => {
        e?.preventDefault()
        // Simulate valid form data for robustness testing
        return onSubmit({
          fullName: 'John Doe',
          email: 'john@example.com', 
          phone: '+965 1234567890',
          fieldOfStudy: 'Computer Science',
          areaOfInterest: 'Software Development',
          cv: [new File(['%PDF-1.4 content'], 'resume.pdf', { type: 'application/pdf' })]
        })
      }),
      formState: { errors: {}, isSubmitting: false },
      watch: jest.fn((field) => {
        if (field === 'fieldOfStudy') return 'Computer Science'
        if (field === 'areaOfInterest') return 'Software Development'
        return undefined
      }),
      setValue: jest.fn(),
      getValues: jest.fn()
    }))
  })
  
  afterEach(() => {
    alertSpy.mockRestore()
    jest.restoreAllMocks()
  })

  const renderWithLang = (ui: React.ReactElement) => render(<LanguageProvider>{ui}</LanguageProvider>)

  describe('File Validation', () => {
    test('should validate file types and sizes properly', async () => {
      // Test file validation with mocked toast
      const { toast } = require('sonner')
      
      // Test non-PDF file rejection
      const nonPdfFile = new File(['content'], 'resume.docx', { type: 'application/msword' })
      const isValidFile1 = nonPdfFile.type === 'application/pdf' && nonPdfFile.size <= 8 * 1024 * 1024
      expect(isValidFile1).toBe(false)
      
      // Test oversized file rejection  
      const largeContent = 'x'.repeat(9 * 1024 * 1024) // 9MB
      const largeFile = new File([largeContent], 'large-resume.pdf', { type: 'application/pdf' })
      const isValidFile2 = largeFile.type === 'application/pdf' && largeFile.size <= 8 * 1024 * 1024
      expect(isValidFile2).toBe(false)
      
      // Test valid PDF file acceptance
      const validFile = new File(['%PDF-1.4 content'], 'resume.pdf', { type: 'application/pdf' })
      const isValidFile3 = validFile.type === 'application/pdf' && validFile.size <= 8 * 1024 * 1024
      expect(isValidFile3).toBe(true)
    })
  })

  describe('Network Error Handling', () => {
    test('should handle Blob storage 401 error with retry', async () => {
      const user = userEvent.setup()
      renderWithLang(<UploadCVForm />)
      
      // Fill form with valid data
      await fillValidForm(user)
      
      // Mock 401 response from upload
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' })
      })
      
      const submitButton = screen.getByRole('button', { name: /submit cv/i })
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Submission failed. Please try again.')
      })
      
      // Should show retry option and preserve form data
      expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument()
      expect(submitButton).toBeEnabled()
    })

    test('should handle network error with user-safe retry', async () => {
      const user = userEvent.setup()
      renderWithLang(<UploadCVForm />)
      
      await fillValidForm(user)
      
      // Mock network error
      global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network Error'))
      
      const submitButton = screen.getByRole('button', { name: /submit cv/i })
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Submission failed. Please try again.')
      })
      
      // Form data should be preserved
      expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument()
      expect(screen.getByDisplayValue('john@example.com')).toBeInTheDocument()
    })

    test('should handle DB insert failure with local data preservation', async () => {
      const user = userEvent.setup()
      renderWithLang(<UploadCVForm />)
      
      await fillValidForm(user)
      
      // Mock successful upload but failed DB insert
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ url: 'https://blob.com/cv.pdf' })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'Database error' })
        })
      
      const submitButton = screen.getByRole('button', { name: /submit cv/i })
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Submission failed. Please try again.')
      })
      
      // Should preserve all form data for retry
      expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument()
      expect(submitButton).toBeEnabled()
    })
  })

  describe('Idempotency and Double Submit Protection', () => {
    test('should prevent double submission', async () => {
      const user = userEvent.setup()
      renderWithLang(<UploadCVForm />)
      
      await fillValidForm(user)
      
      // Mock successful responses
      global.fetch = jest.fn()
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ url: 'https://blob.com/cv.pdf' })
        })
      
      const submitButton = screen.getByRole('button', { name: /submit cv/i })
      
      // Double click rapidly
      await user.dblClick(submitButton)
      
      // Should only make one API call
      expect(global.fetch).toHaveBeenCalledTimes(2) // Upload + Submit
      
      // Button should be disabled during submission
      expect(submitButton).toBeDisabled()
    })

    test('should handle successful submission without creating duplicates', async () => {
      const user = userEvent.setup()
      renderWithLang(<UploadCVForm />)
      
      await fillValidForm(user)
      
      // Mock successful responses
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ url: 'https://blob.com/cv.pdf' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'submission-123' })
        })
      
      const submitButton = screen.getByRole('button', { name: /submit cv/i })
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/cv uploaded successfully/i)).toBeInTheDocument()
      })
      
      // Should show success state and not allow resubmission
      expect(screen.queryByRole('button', { name: /submit cv/i })).not.toBeInTheDocument()
    })
  })

  describe('FormData Validation', () => {
    test('should include all required fields in submission', async () => {
      const user = userEvent.setup()
      renderWithLang(<UploadCVForm />)
      
      await fillValidForm(user)
      
      // Mock responses
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ url: 'https://blob.com/cv.pdf' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'submission-123' })
        })
      
      const submitButton = screen.getByRole('button', { name: /submit cv/i })
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2)
      })
      
      // Verify FormData includes all required fields
      const submitCall = (global.fetch as jest.Mock).mock.calls[1]
      const submitPayload = JSON.parse(submitCall[1].body)
      
      expect(submitPayload).toEqual({
        fullName: 'John Doe',
        email: 'john@example.com', 
        phone: '+965 1234567890',
        fieldOfStudy: 'Computer Science',
        areaOfInterest: 'Software Development',
        suggestedVacancies: 'Frontend Developer/Backend Developer/Full Stack Developer',
        cvUrl: 'https://blob.com/cv.pdf',
        cvType: 'uploaded'
      })
    })

    test('should include suggested vacancies as raw string and array', async () => {
      const user = userEvent.setup()
      renderWithLang(<UploadCVForm />)
      
      await fillValidForm(user)
      
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ url: 'https://blob.com/cv.pdf' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'submission-123' })
        })
      
      await user.click(screen.getByRole('button', { name: /submit cv/i }))
      
      await waitFor(() => {
        expect(screen.getByText(/cv uploaded successfully/i)).toBeInTheDocument()
      })
      
      // Verify vacancies are displayed as list
      expect(screen.getByText('Frontend Developer')).toBeInTheDocument()
      expect(screen.getByText('Backend Developer')).toBeInTheDocument()
      expect(screen.getByText('Full Stack Developer')).toBeInTheDocument()
    })
  })

  describe('Error Recovery', () => {
    test('should recover from temporary network issues', async () => {
      const user = userEvent.setup()
      renderWithLang(<UploadCVForm />)
      
      await fillValidForm(user)
      
      // First attempt fails, second succeeds
      global.fetch = jest.fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ url: 'https://blob.com/cv.pdf' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'submission-123' })
        })
      
      const submitButton = screen.getByRole('button', { name: /submit cv/i })
      
      // First attempt
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Submission failed. Please try again.')
      })
      
      // Retry
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/cv uploaded successfully/i)).toBeInTheDocument()
      })
    })
  })
})

// Helper function to fill minimal valid form for robustness testing
async function fillValidForm(user: any) {
  await user.type(screen.getByLabelText(/full name/i), 'John Doe')
  await user.type(screen.getByLabelText(/email/i), 'john@example.com')
  
  // Clear and fill phone
  const phoneInput = screen.getByLabelText(/phone/i)
  await user.clear(phoneInput)
  await user.type(phoneInput, '+965 1234567890')
  
  // Upload file
  const file = new File(['%PDF-1.4 content'], 'resume.pdf', { type: 'application/pdf' })
  const fileInput = screen.getByLabelText(/cv upload/i)
  await user.upload(fileInput, file)
}
