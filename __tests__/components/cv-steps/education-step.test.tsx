import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EducationStep } from '@/components/cv-steps/education-step'
import { renderWithForm } from '../../utils/test-utils'

describe('EducationStep', () => {
  test('renders with default education entry', () => {
    renderWithForm(<EducationStep />)
    
    // Should render Education 1 heading
    expect(screen.getByText('Education 1')).toBeInTheDocument()
    
    // Should render required fields
    expect(screen.getByLabelText(/institution/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/degree/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/field of study/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument()
    
    // Should render optional fields
    expect(screen.getByLabelText(/gpa/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
    
    // Should render "Add Education" button
    expect(screen.getByRole('button', { name: /add education/i })).toBeInTheDocument()
  })

  test('adds new education entry when "Add Education" is clicked', async () => {
    const user = userEvent.setup()
    renderWithForm(<EducationStep />)
    
    const addButton = screen.getByRole('button', { name: /add education/i })
    await user.click(addButton)
    
    // Should now have Education 1 and Education 2
    expect(screen.getByText('Education 1')).toBeInTheDocument()
    expect(screen.getByText('Education 2')).toBeInTheDocument()
    
    // Should have delete buttons for both entries
    expect(screen.getAllByRole('button', { name: /remove education/i })).toHaveLength(2) // Trash buttons
  })

  test('removes education entry when delete button is clicked', async () => {
    const user = userEvent.setup()
    renderWithForm(<EducationStep />)
    
    // Add a second education entry
    const addButton = screen.getByRole('button', { name: /add education/i })
    await user.click(addButton)
    
    // Verify we have 2 entries
    expect(screen.getByText('Education 1')).toBeInTheDocument()
    expect(screen.getByText('Education 2')).toBeInTheDocument()
    
    // Remove the second entry
    const deleteButtons = screen.getAllByRole('button', { name: /remove education/i })
    await user.click(deleteButtons[1])
    
    // Should only have Education 1 left
    expect(screen.getByText('Education 1')).toBeInTheDocument()
    expect(screen.queryByText('Education 2')).not.toBeInTheDocument()
  })

  test('does not show delete button when only one education entry exists', () => {
    renderWithForm(<EducationStep />)
    
    // Should not have delete button with only one entry
    expect(screen.queryByRole('button', { name: /remove education/i })).not.toBeInTheDocument()
  })

  test('validates required fields', async () => {
    const user = userEvent.setup()
    renderWithForm(<EducationStep />)
    
    const institutionInput = screen.getByTestId('field-education-0-institution')
    const degreeInput = screen.getByTestId('field-education-0-degree')
    const fieldInput = screen.getByTestId('field-education-0-field')
    const startDateInput = screen.getByTestId('field-education-0-startDate')
    
    // Type and then clear to trigger validation
    await user.type(institutionInput, 'test')
    await user.clear(institutionInput)
    
    await user.type(degreeInput, 'test')
    await user.clear(degreeInput)
    
    await user.type(fieldInput, 'test')
    await user.clear(fieldInput)
    
    await user.type(startDateInput, '2023-05')
    await user.clear(startDateInput)
    
    await waitFor(() => {
      expect(institutionInput).toHaveAttribute('aria-invalid', 'true')
      expect(degreeInput).toHaveAttribute('aria-invalid', 'true')
      expect(fieldInput).toHaveAttribute('aria-invalid', 'true')
      expect(startDateInput).toHaveAttribute('aria-invalid', 'true')
    })
  })

  test('accepts valid GPA format', async () => {
    const user = userEvent.setup()
    renderWithForm(<EducationStep />)
    
    const gpaInput = screen.getByTestId('field-education-0-gpa')
    
    // Enter valid GPA
    await user.type(gpaInput, '3.8')
    
    expect(gpaInput).toHaveValue('3.8')
    expect(gpaInput).toHaveAttribute('aria-invalid', 'false')
  })

  test('clears validation errors when valid data is entered', async () => {
    const user = userEvent.setup()
    renderWithForm(<EducationStep />)
    
    const institutionInput = screen.getByTestId('field-education-0-institution')
    const degreeInput = screen.getByTestId('field-education-0-degree')
    
    // Trigger validation errors
    await user.type(institutionInput, 'test')
    await user.clear(institutionInput)
    await user.type(degreeInput, 'test')
    await user.clear(degreeInput)
    
    await waitFor(() => {
      expect(institutionInput).toHaveAttribute('aria-invalid', 'true')
      expect(degreeInput).toHaveAttribute('aria-invalid', 'true')
    })
    
    // Enter valid data
    await user.type(institutionInput, 'University of Technology')
    await user.type(degreeInput, 'Bachelor of Science')
    
    await waitFor(() => {
      expect(institutionInput).toHaveAttribute('aria-invalid', 'false')
      expect(degreeInput).toHaveAttribute('aria-invalid', 'false')
    })
  })

  test('start date input accepts month format', async () => {
    const user = userEvent.setup()
    renderWithForm(<EducationStep />)
    
    const startDateInput = screen.getByTestId('field-education-0-startDate')
    
    await user.type(startDateInput, '2023-12')
    
    expect(startDateInput).toHaveValue('2023-12')
  })

  test('description field is optional', async () => {
    const user = userEvent.setup()
    renderWithForm(<EducationStep />)
    
    const descriptionField = screen.getByLabelText(/description/i)
    
    await user.click(descriptionField)
    await user.tab()
    
    // Should not have validation error for optional field
    expect(descriptionField).not.toHaveAttribute('aria-invalid', 'true')
  })

  test('GPA field is optional', async () => {
    const user = userEvent.setup()
    renderWithForm(<EducationStep />)
    
    const gpaInput = screen.getByTestId('field-education-0-gpa')
    
    await user.click(gpaInput)
    await user.tab()
    
    // Should not have validation error for optional field
    expect(gpaInput).not.toHaveAttribute('aria-invalid', 'true')
  })

  test('manages multiple education entries independently', async () => {
    const user = userEvent.setup()
    renderWithForm(<EducationStep />)
    
    // Add second education entry
    const addButton = screen.getByRole('button', { name: /add education/i })
    await user.click(addButton)
    
    // Fill first education entry
    const firstInstitution = screen.getByTestId('field-education-0-institution')
    const secondInstitution = screen.getByTestId('field-education-1-institution')
    
    await user.type(firstInstitution, 'University A')
    await user.type(secondInstitution, 'University B')
    
    expect(firstInstitution).toHaveValue('University A')
    expect(secondInstitution).toHaveValue('University B')
  })

  test('preserves data when removing non-active entries', async () => {
    const user = userEvent.setup()
    renderWithForm(<EducationStep />)
    
    // Add two more entries for a total of 3
    const addButton = screen.getByRole('button', { name: /add education/i })
    await user.click(addButton)
    await user.click(addButton)
    
    // Fill all entries
    await user.type(screen.getByTestId('field-education-0-institution'), 'University A')
    await user.type(screen.getByTestId('field-education-1-institution'), 'University B')
    await user.type(screen.getByTestId('field-education-2-institution'), 'University C')
    
    // Remove middle entry
    const deleteButtons = screen.getAllByRole('button', { name: /remove education/i })
    await user.click(deleteButtons[1])
    
    // Verify remaining entries maintain their data
    expect(screen.getByTestId('field-education-0-institution')).toHaveValue('University A')
    expect(screen.getByTestId('field-education-1-institution')).toHaveValue('University C')
  })
})
