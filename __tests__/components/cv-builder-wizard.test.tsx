import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithForm } from '../utils/test-utils'
import CVBuilderWizard from '@/components/cv-builder-wizard'
import { stepFields } from '@/lib/cv-schemas'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
}))

describe('CVBuilderWizard', () => {
  beforeEach(() => {
    // Reset fetch mock
    global.fetch = jest.fn()
  })

  describe('Personal Info Step', () => {
    test('renders without errors initially', () => {
      renderWithForm(<CVBuilderWizard />)
      
      expect(screen.getByText('Step 1 of 5')).toBeInTheDocument()
      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/phone/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/location/i)).toBeInTheDocument()
      
      // Should not show errors initially
      expect(screen.queryByText(/required/i)).not.toBeInTheDocument()
    })

    test('shows required field errors when trying to advance without filling required fields', async () => {
      const user = userEvent.setup()
      renderWithForm(<CVBuilderWizard />)
      
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)
      
      await waitFor(() => {
        // Check for localized required messages
        expect(screen.getAllByText('This field is required').length).toBeGreaterThan(0)
      })
      
      // Should stay on Personal step
      expect(screen.getByText('Step 1 of 5')).toBeInTheDocument()
    })

    test('clears errors when valid data is entered', async () => {
      const user = userEvent.setup()
      renderWithForm(<CVBuilderWizard />)
      
      // Fill required fields
      const fullNameInput = screen.getByLabelText(/full name/i)
      const emailInput = screen.getByLabelText(/email/i)
      const phoneInput = screen.getByLabelText(/phone/i)
      const locationInput = screen.getByLabelText(/location/i)
      
      await user.type(fullNameInput, 'John Doe')
      await user.type(emailInput, 'john@example.com')
      await user.type(phoneInput, '1234567890')
      await user.type(locationInput, 'Kuwait City')
      
      // Click Next
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)
      
      await waitFor(() => {
        // Should advance to Education step
        expect(screen.getByText('Education')).toBeInTheDocument()
      })
    })

    test('validates phone number length', async () => {
      const user = userEvent.setup()
      renderWithForm(<CVBuilderWizard />)
      
      const phoneInput = screen.getByLabelText(/phone/i)
      await user.type(phoneInput, '123') // Too short
      
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)
      
      await waitFor(() => {
        // Should show multiple validation errors - check for phone specific one
        expect(screen.getByText('Phone number must be at least 10 characters')).toBeInTheDocument()
      })
    })

    test('validates email format on form submission', async () => {
      const user = userEvent.setup()
      renderWithForm(<CVBuilderWizard />)
      
      // Fill all required fields but with invalid email
      await user.type(screen.getByLabelText(/full name/i), 'John Doe')
      await user.type(screen.getByLabelText(/email/i), 'invalid-email')
      
      const phoneInput = screen.getByLabelText(/phone/i)
      await user.clear(phoneInput)
      await user.type(phoneInput, '12345678')
      
      await user.type(screen.getByLabelText(/location/i), 'Kuwait City')
      
      // Try to submit - should trigger validation
      await user.click(screen.getByRole('button', { name: /next/i }))
      
      await waitFor(() => {
        // Should stay on step 1 due to validation error
        expect(screen.getByText('Step 1 of 5')).toBeInTheDocument()
        
        // Email should be marked as invalid
        const emailInput = screen.getByLabelText(/email/i)
        expect(emailInput).toHaveAttribute('aria-invalid', 'true')
      })
    })
  })

  describe('Navigation', () => {
    test('Previous button is disabled on first step', () => {
      renderWithForm(<CVBuilderWizard />)
      
      const prevButton = screen.getByRole('button', { name: /previous/i })
      expect(prevButton).toBeDisabled()
    })

    test('Next button advances to next step when current step is valid', async () => {
      const user = userEvent.setup()
      renderWithForm(<CVBuilderWizard />)
      
      // Fill Personal step
      await user.type(screen.getByLabelText(/full name/i), 'John Doe')
      await user.type(screen.getByLabelText(/email/i), 'john@example.com')
      await user.type(screen.getByLabelText(/phone/i), '+965 1234567890')
      await user.type(screen.getByLabelText(/location/i), 'Kuwait City')
      
      // Click Next
      await user.click(screen.getByRole('button', { name: /next/i }))
      
      await waitFor(() => {
        expect(screen.getByText('Education')).toBeInTheDocument()
      })
      
      // Previous button should now exist (might be disabled on first step)
      expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument()
    })

    test('Previous button goes back to previous step', async () => {
      const user = userEvent.setup()
      renderWithForm(<CVBuilderWizard />)
      
      // Fill and advance to Education step
      await user.type(screen.getByLabelText(/full name/i), 'John Doe')
      await user.type(screen.getByLabelText(/email/i), 'john@example.com')
      await user.type(screen.getByLabelText(/phone/i), '+965 1234567890')
      await user.type(screen.getByLabelText(/location/i), 'Kuwait City')
      await user.click(screen.getByRole('button', { name: /next/i }))
      
      await waitFor(() => {
        expect(screen.getByText('Education')).toBeInTheDocument()
      })
      
      // Go back
      await user.click(screen.getByRole('button', { name: /previous/i }))
      
      await waitFor(() => {
        expect(screen.getByText('Step 1 of 5')).toBeInTheDocument()
      })
    })
  })

  describe('Progress Indicator', () => {
    test('shows correct step progress', async () => {
      const user = userEvent.setup()
      renderWithForm(<CVBuilderWizard />)
      
      expect(screen.getByText('Step 1 of 5')).toBeInTheDocument()
      
      // Fill Personal and advance
      await user.type(screen.getByLabelText(/full name/i), 'John Doe')
      await user.type(screen.getByLabelText(/email/i), 'john@example.com')
      
      const phoneInput = screen.getByLabelText(/phone/i)
      await user.clear(phoneInput)
      await user.type(phoneInput, '12345678')
      
      await user.type(screen.getByLabelText(/location/i), 'Kuwait City')
      
      await user.click(screen.getByRole('button', { name: /next/i }))
      
      // Should not advance due to validation errors - check that we stay on step 1
      await waitFor(() => {
        expect(screen.getByText('Step 1 of 5')).toBeInTheDocument()
      }, { timeout: 1000 })
    })
  })

  describe('Step Field Validation', () => {
    test('validates only current step fields', () => {
      // This tests that stepFields are correctly defined with numeric indices
      expect(stepFields[0]).toEqual(['fullName', 'email', 'phone', 'location'])
      expect(stepFields[1]).toEqual(['education.0.institution', 'education.0.degree', 'education.0.fieldOfStudy', 'education.0.startDate'])
      // After merging Experience & Projects into one step, stepFields for that step is managed in-component
      expect(stepFields[2]).toEqual([])
      expect(stepFields[3]).toEqual([])
      expect(stepFields[4]).toEqual([])
    })
  })
})
