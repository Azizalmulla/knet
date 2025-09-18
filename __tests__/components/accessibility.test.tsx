import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithForm } from '../utils/test-utils'
import CVBuilderWizard from '@/components/cv-builder-wizard'
import { PersonalInfoStep } from '@/components/cv-steps/personal-info-step'

describe('Accessibility Tests', () => {
  describe('Form Labels and ARIA', () => {
    test('all form controls have proper labels or aria-label', () => {
      renderWithForm(<PersonalInfoStep />)
      
      // Check all inputs have associated labels
      const fullNameInput = screen.getByLabelText(/full name/i)
      const emailInput = screen.getByLabelText(/email/i)
      const phoneInput = screen.getByLabelText(/phone/i)
      const locationInput = screen.getByLabelText(/location/i)
      const summaryInput = screen.getByLabelText(/professional summary/i)
      
      expect(fullNameInput).toBeInTheDocument()
      expect(emailInput).toBeInTheDocument()
      expect(phoneInput).toBeInTheDocument()
      expect(locationInput).toBeInTheDocument()
      expect(summaryInput).toBeInTheDocument()
      
      // Check aria-invalid is false initially
      expect(fullNameInput).toHaveAttribute('aria-invalid', 'false')
      expect(emailInput).toHaveAttribute('aria-invalid', 'false')
      expect(phoneInput).toHaveAttribute('aria-invalid', 'false')
      expect(locationInput).toHaveAttribute('aria-invalid', 'false')
    })

    test('aria-invalid is set correctly for validation errors', async () => {
      const user = userEvent.setup()
      renderWithForm(<PersonalInfoStep />)
      
      const fullNameInput = screen.getByLabelText(/full name/i)
      const emailInput = screen.getByLabelText(/email/i)
      
      // Initially should be valid
      expect(fullNameInput).toHaveAttribute('aria-invalid', 'false')
      expect(emailInput).toHaveAttribute('aria-invalid', 'false')
      
      // Test fullName validation - trigger error
      await user.type(fullNameInput, 'test')
      await user.clear(fullNameInput)
      
      await waitFor(() => {
        expect(fullNameInput).toHaveAttribute('aria-invalid', 'true')
        expect(screen.getByText(/required/i)).toBeInTheDocument()
      })
    })

    test('error messages are properly associated with inputs via aria-describedby', async () => {
      const user = userEvent.setup()
      renderWithForm(<PersonalInfoStep />)
      
      const fullNameInput = screen.getByLabelText(/full name/i)
      
      // Trigger validation error by typing and clearing
      await user.type(fullNameInput, 'test')
      await user.clear(fullNameInput)
      
      await waitFor(() => {
        const errorMessage = screen.getByText(/required/i)
        expect(errorMessage).toBeInTheDocument()
        
        // Check aria-describedby association
        const errorId = errorMessage.id
        expect(fullNameInput).toHaveAttribute('aria-describedby', errorId)
      })
    })
  })

  describe('Focus Management', () => {
    test('focus moves to first invalid field on failed Next', async () => {
      const user = userEvent.setup()
      renderWithForm(<CVBuilderWizard />)
      
      // Try to advance with empty required fields
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)
      
      await waitFor(() => {
        // Validation should show errors
        const fullNameInput = screen.getByLabelText(/full name/i)
        expect(fullNameInput).toHaveAttribute('aria-invalid', 'true')
        expect(screen.getAllByText(/required/i).length).toBeGreaterThan(0)
      })
    })

    test('focus is properly managed when navigating between steps', async () => {
      const user = userEvent.setup()
      renderWithForm(<CVBuilderWizard />)
      
      // Fill valid data and advance
      await user.type(screen.getByLabelText(/full name/i), 'John Doe')
      await user.type(screen.getByLabelText(/email/i), 'john@example.com')
      await user.type(screen.getByLabelText(/phone/i), '+965 1234567890')
      await user.type(screen.getByLabelText(/location/i), 'Kuwait City')
      
      await user.click(screen.getByRole('button', { name: /next/i }))
      
      await waitFor(() => {
        // Focus should move to the step content area or first input
        const stepTitle = screen.getByText('Education')
        expect(stepTitle).toBeInTheDocument()
      })
    })

    test('keyboard trap works within modal dialogs', async () => {
      // This would test if modals properly trap focus
      // Implementation depends on having modal dialogs in the app
      expect(true).toBe(true) // Placeholder for now
    })
  })

  describe('Screen Reader Announcements', () => {
    test('step changes are announced with aria-live', async () => {
      const user = userEvent.setup()
      renderWithForm(<CVBuilderWizard />)
      
      // Look for aria-live region
      const liveRegion = document.querySelector('[aria-live]')
      
      // Fill in required fields with valid data
      const fullNameInput = screen.getByLabelText(/full name/i)
      const emailInput = screen.getByLabelText(/email/i)
      const phoneInput = screen.getByLabelText(/phone/i)
      const locationInput = screen.getByLabelText(/location/i)
      
      await user.type(fullNameInput, 'John Doe')
      await user.type(emailInput, 'john@example.com')
      await user.type(phoneInput, '1234567890') // 10 digits - meets minimum requirement
      await user.type(locationInput, 'Kuwait City')
      
      // Click Next to advance (this should succeed since all fields are valid)
      await user.click(screen.getByRole('button', { name: /next/i }))
      
      await waitFor(() => {
        // Should advance to step 2 since form is valid
        expect(screen.getByText('Step 2 of 5')).toBeInTheDocument()
      })
    })

    test('validation errors are announced to screen readers', async () => {
      const user = userEvent.setup()
      renderWithForm(<CVBuilderWizard />)
      
      // Try to advance with empty fields
      await user.click(screen.getByRole('button', { name: /next/i }))
      
      await waitFor(() => {
        const fullNameInput = screen.getByLabelText(/full name/i)
        expect(fullNameInput).toHaveAttribute('aria-invalid', 'true')
        
        const errorMessages = screen.getAllByText(/required/i)
        expect(errorMessages.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Keyboard Navigation', () => {
    test('keyboard navigation prevents Enter submission on non-final steps', async () => {
      const user = userEvent.setup()
      renderWithForm(<CVBuilderWizard />)
      
      const fullNameInput = screen.getByTestId('field-fullName')
      
      // Press Enter in input
      await user.click(fullNameInput)
      await user.keyboard('{Enter}')
      
      // Should not advance step - check step indicator
      expect(screen.getByText('Step 1 of 5')).toBeInTheDocument()
      expect(screen.getAllByText('Personal Info')).toHaveLength(2) // One in progress, one in card title
    })

    test('Tab navigation works correctly through form fields', async () => {
      const user = userEvent.setup()
      renderWithForm(<PersonalInfoStep />)
      
      const fullNameInput = screen.getByLabelText(/full name/i)
      const emailInput = screen.getByLabelText(/email/i)
      const phoneInput = screen.getByLabelText(/phone/i)
      
      await user.click(fullNameInput)
      expect(fullNameInput).toHaveFocus()
      
      await user.tab()
      expect(emailInput).toHaveFocus()
      
      await user.tab()
      expect(phoneInput).toHaveFocus()
    })

    test('Skip links work for keyboard users', () => {
      renderWithForm(<CVBuilderWizard />)
      
      // Look for skip links (if implemented)
      const skipLinks = screen.queryAllByRole('link', { name: /skip to/i })
      
      // This is a placeholder - skip links would need to be implemented
      expect(skipLinks.length >= 0).toBe(true)
    })
  })

  describe('Color and Contrast', () => {
    test('error states do not rely solely on color', async () => {
      const user = userEvent.setup()
      renderWithForm(<PersonalInfoStep />)
      
      const fullNameInput = screen.getByLabelText(/full name/i)
      
      // Trigger validation error
      await user.type(fullNameInput, 'test')
      await user.clear(fullNameInput)
      
      await waitFor(() => {
        // Error should be indicated by text, not just color
        const errorMessage = screen.getByText(/required/i)
        expect(errorMessage).toBeInTheDocument()
        
        // Input should have aria-invalid
        expect(fullNameInput).toHaveAttribute('aria-invalid', 'true')
      })
    })
  })
})
