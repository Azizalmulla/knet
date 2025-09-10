import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExperienceStep } from '@/components/cv-steps/experience-step'
import { renderWithForm } from '../../utils/test-utils'

// Mock fetch for AI generation
global.fetch = jest.fn()

describe('ExperienceStep', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('renders with default state', () => {
    renderWithForm(<ExperienceStep />)
    
    // Should render "Add Experience" button initially (no default entries)
    expect(screen.getByRole('button', { name: /add experience/i })).toBeInTheDocument()
    
    // Should not render any experience cards initially
    expect(screen.queryByText('Experience 1')).not.toBeInTheDocument()
  })

  test('adds new experience entry when "Add Experience" is clicked', async () => {
    const user = userEvent.setup()
    renderWithForm(<ExperienceStep />)
    
    const addButton = screen.getByRole('button', { name: /add experience/i })
    await user.click(addButton)
    
    // Should now have Experience 1
    expect(screen.getByText('Experience 1')).toBeInTheDocument()
    
    // Should render required fields
    expect(screen.getByLabelText(/company/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/position/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument()
    
    // Should render optional fields
    expect(screen.getByLabelText(/end date/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/currently working here/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/raw description/i)).toBeInTheDocument()
    
    // Should have delete button
    expect(screen.getByRole('button', { name: '' })).toBeInTheDocument() // Trash button
  })

  test('adds multiple experience entries', async () => {
    const user = userEvent.setup()
    renderWithForm(<ExperienceStep />)
    
    const addButton = screen.getByRole('button', { name: /add experience/i })
    
    // Add two experiences
    await user.click(addButton)
    await user.click(addButton)
    
    expect(screen.getByText('Experience 1')).toBeInTheDocument()
    expect(screen.getByText('Experience 2')).toBeInTheDocument()
    
    // Should have 2 delete buttons
    expect(screen.getAllByRole('button', { name: '' })).toHaveLength(2)
  })

  test('removes experience entry when delete button is clicked', async () => {
    const user = userEvent.setup()
    renderWithForm(<ExperienceStep />)
    
    const addButton = screen.getByRole('button', { name: /add experience/i })
    
    // Add two experiences
    await user.click(addButton)
    await user.click(addButton)
    
    expect(screen.getByText('Experience 1')).toBeInTheDocument()
    expect(screen.getByText('Experience 2')).toBeInTheDocument()
    
    // Remove the first experience
    const deleteButtons = screen.getAllByRole('button', { name: '' })
    await user.click(deleteButtons[0])
    
    // Should only have Experience 1 left (the second one becomes first)
    expect(screen.getByText('Experience 1')).toBeInTheDocument()
    expect(screen.queryByText('Experience 2')).not.toBeInTheDocument()
  })

  test('validates required fields', async () => {
    const user = userEvent.setup()
    renderWithForm(<ExperienceStep />)
    
    // Add an experience entry
    const addButton = screen.getByRole('button', { name: /add experience/i })
    await user.click(addButton)
    
    const companyInput = screen.getByTestId('field-experience-0-company')
    const positionInput = screen.getByTestId('field-experience-0-position')
    const startDateInput = screen.getByTestId('field-experience-0-startDate')
    
    // Type and then clear to trigger validation
    await user.type(companyInput, 'test')
    await user.clear(companyInput)
    
    await user.type(positionInput, 'test')
    await user.clear(positionInput)
    
    await user.type(startDateInput, '2023-01')
    await user.clear(startDateInput)
    
    await waitFor(() => {
      expect(companyInput).toHaveAttribute('aria-invalid', 'true')
      expect(positionInput).toHaveAttribute('aria-invalid', 'true')
      expect(startDateInput).toHaveAttribute('aria-invalid', 'true')
    })
  })

  test('clears validation errors when valid data is entered', async () => {
    const user = userEvent.setup()
    renderWithForm(<ExperienceStep />)
    
    // Add an experience entry
    const addButton = screen.getByRole('button', { name: /add experience/i })
    await user.click(addButton)
    
    const companyInput = screen.getByTestId('field-experience-0-company')
    const positionInput = screen.getByTestId('field-experience-0-position')
    
    // Trigger validation errors
    await user.type(companyInput, 'test')
    await user.clear(companyInput)
    await user.type(positionInput, 'test')
    await user.clear(positionInput)
    
    await waitFor(() => {
      expect(companyInput).toHaveAttribute('aria-invalid', 'true')
      expect(positionInput).toHaveAttribute('aria-invalid', 'true')
    })
    
    // Enter valid data
    await user.type(companyInput, 'Tech Corp')
    await user.type(positionInput, 'Software Engineer')
    
    await waitFor(() => {
      expect(companyInput).toHaveAttribute('aria-invalid', 'false')
      expect(positionInput).toHaveAttribute('aria-invalid', 'false')
    })
  })

  test('manages multiple experience entries independently', async () => {
    const user = userEvent.setup()
    renderWithForm(<ExperienceStep />)
    
    const addButton = screen.getByRole('button', { name: /add experience/i })
    
    // Add two experiences
    await user.click(addButton)
    await user.click(addButton)
    
    // Fill different data in each
    const firstCompany = screen.getByTestId('field-experience-0-company')
    const secondCompany = screen.getByTestId('field-experience-1-company')
    
    await user.type(firstCompany, 'Company A')
    await user.type(secondCompany, 'Company B')
    
    expect(firstCompany).toHaveValue('Company A')
    expect(secondCompany).toHaveValue('Company B')
  })

  test('end date field is optional', async () => {
    const user = userEvent.setup()
    renderWithForm(<ExperienceStep />)
    
    // Add an experience entry
    const addButton = screen.getByRole('button', { name: /add experience/i })
    await user.click(addButton)
    
    const endDateInput = screen.getByTestId('field-experience-0-endDate')
    
    await user.click(endDateInput)
    await user.tab()
    
    // Should not have validation error for optional field
    expect(endDateInput).not.toHaveAttribute('aria-invalid', 'true')
  })

  test('description field is optional', async () => {
    const user = userEvent.setup()
    renderWithForm(<ExperienceStep />)
    
    // Add an experience entry
    const addButton = screen.getByRole('button', { name: /add experience/i })
    await user.click(addButton)
    
    const descriptionField = screen.getByLabelText(/raw description/i)
    
    await user.click(descriptionField)
    await user.tab()
    
    // Should not have validation error for optional field
    expect(descriptionField).not.toHaveAttribute('aria-invalid', 'true')
  })

  test('currently working here checkbox toggles correctly', async () => {
    const user = userEvent.setup()
    renderWithForm(<ExperienceStep />)
    
    // Add an experience entry
    const addButton = screen.getByRole('button', { name: /add experience/i })
    await user.click(addButton)
    
    const currentCheckbox = screen.getByLabelText(/currently working here/i)
    
    expect(currentCheckbox).not.toBeChecked()
    
    await user.click(currentCheckbox)
    expect(currentCheckbox).toBeChecked()
    
    await user.click(currentCheckbox)
    expect(currentCheckbox).not.toBeChecked()
  })

  test('generate ATS bullets button is present', async () => {
    const user = userEvent.setup()
    renderWithForm(<ExperienceStep />)
    
    // Add an experience entry
    const addButton = screen.getByRole('button', { name: /add experience/i })
    await user.click(addButton)
    
    const generateButton = screen.getByRole('button', { name: /generate ats bullets/i })
    expect(generateButton).toBeInTheDocument()
    expect(generateButton).toBeEnabled()
  })

  test('generate ATS bullets calls API when description is provided', async () => {
    const mockFetch = jest.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ bullets: ['• Bullet 1', '• Bullet 2'] })
    } as Response)
    
    const user = userEvent.setup()
    renderWithForm(<ExperienceStep />)
    
    // Add an experience entry
    const addButton = screen.getByRole('button', { name: /add experience/i })
    await user.click(addButton)
    
    const descriptionField = screen.getByLabelText(/raw description/i)
    const generateButton = screen.getByRole('button', { name: /generate ats bullets/i })
    
    // Add description
    await user.type(descriptionField, 'Developed software applications')
    
    // Click generate
    await user.click(generateButton)
    
    expect(mockFetch).toHaveBeenCalledWith('/api/ai/rewrite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawText: 'Developed software applications',
        section: 'experience',
      }),
    })
  })

  test('shows loading state during bullet generation', async () => {
    const mockFetch = jest.mocked(fetch)
    mockFetch.mockImplementationOnce(() => 
      new Promise(resolve => 
        setTimeout(() => resolve({
          ok: true,
          json: async () => ({ bullets: ['• Bullet 1'] })
        } as Response), 100)
      )
    )
    
    const user = userEvent.setup()
    renderWithForm(<ExperienceStep />)
    
    // Add an experience entry
    const addButton = screen.getByRole('button', { name: /add experience/i })
    await user.click(addButton)
    
    const descriptionField = screen.getByLabelText(/raw description/i)
    
    // Add description and click generate
    await user.type(descriptionField, 'Test description')
    const generateButton = screen.getByRole('button', { name: /generate ats bullets/i })
    await user.click(generateButton)
    
    // Should show loading state
    expect(screen.getByRole('button', { name: /generating.../i })).toBeInTheDocument()
    
    // Wait for completion
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /generate ats bullets/i })).toBeInTheDocument()
    })
  })
})
