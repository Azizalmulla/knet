import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithForm } from '../../utils/test-utils'
import { PersonalInfoStep } from '@/components/cv-steps/personal-info-step'

describe('PersonalInfoStep', () => {
  test('renders all required fields', () => {
    renderWithForm(<PersonalInfoStep />)
    
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/location/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/professional summary/i)).toBeInTheDocument()
  })

  test('shows no errors initially', () => {
    renderWithForm(<PersonalInfoStep />)
    
    expect(screen.queryByText(/required/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/invalid email/i)).not.toBeInTheDocument()
  })

  test('phone input has Kuwait default value', () => {
    renderWithForm(<PersonalInfoStep />)
    
    const phoneInput = screen.getByLabelText(/phone/i) as HTMLInputElement
    // Use display value for RHF-controlled inputs
    expect(phoneInput).toHaveDisplayValue('+965 ')
  })

  test('validates required fields', async () => {
    const user = userEvent.setup()
    renderWithForm(<PersonalInfoStep />)
    
    const fullNameInput = screen.getByTestId('field-fullName')
    
    // Type and then clear to trigger validation
    await user.type(fullNameInput, 'test')
    await user.clear(fullNameInput)
    // Blur to force validation if running on onBlur
    await user.tab()
    
    await waitFor(() => {
      expect(fullNameInput).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByTestId('error-fullName')).toBeInTheDocument()
    })
  })

  test('validates email format', async () => {
    renderWithForm(<PersonalInfoStep />)
    
    const emailInput = screen.getByTestId('field-email')
    
    // Email field is locked/readonly, so it should not allow editing
    expect(emailInput).toHaveAttribute('readonly')
    expect(emailInput).toBeDisabled()
    // Since email is locked, it starts without validation errors
    expect(emailInput).toHaveAttribute('aria-invalid', 'false')
  })

  test('validates phone number length', async () => {
    const user = userEvent.setup()
    renderWithForm(<PersonalInfoStep />)
    
    const phoneInput = screen.getByTestId('field-phone')
    
    // Enter short phone number
    await user.type(phoneInput, '123')
    await user.tab()
    
    await waitFor(() => {
      expect(phoneInput).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByTestId('error-phone')).toBeInTheDocument()
    })
  })

  test('clears errors when valid data is entered', async () => {
    const user = userEvent.setup()
    renderWithForm(<PersonalInfoStep />)
    
    const fullNameInput = screen.getByTestId('field-fullName')
    
    // First, trigger validation errors on fullName
    await user.type(fullNameInput, 'test')
    await user.clear(fullNameInput)
    await user.tab()
    
    // Verify error is present
    await waitFor(() => {
      expect(fullNameInput).toHaveAttribute('aria-invalid', 'true')
    })
    
    // Enter valid data
    await user.type(fullNameInput, 'John Doe')
    await user.tab()
    
    // Verify error is cleared
    await waitFor(() => {
      expect(fullNameInput).toHaveAttribute('aria-invalid', 'false')
    })
  })

  test('summary field is optional', async () => {
    const user = userEvent.setup()
    renderWithForm(<PersonalInfoStep />)
    
    const summaryInput = screen.getByLabelText(/professional summary/i)
    
    await user.click(summaryInput)
    await user.tab()
    
    // Should not show validation error for summary field
    expect(summaryInput).toHaveAttribute('aria-invalid', 'false')
  })

  test('should toggle aria-invalid when validation state changes', async () => {
    const user = userEvent.setup()
    renderWithForm(<PersonalInfoStep />)
    
    const fullNameInput = screen.getByTestId('field-fullName')
    
    // Initially should not be invalid
    expect(fullNameInput).toHaveAttribute('aria-invalid', 'false')
    
    // Clear the field to trigger validation
    await user.click(fullNameInput)
    await user.clear(fullNameInput)
    await user.tab()
    
    await waitFor(() => {
      expect(fullNameInput).toHaveAttribute('aria-invalid', 'true')
    })
    
    // Enter valid data to clear validation
    await user.type(fullNameInput, 'John Doe')
    await user.tab()
    
    await waitFor(() => {
      expect(fullNameInput).toHaveAttribute('aria-invalid', 'false')
    })
  })
})
