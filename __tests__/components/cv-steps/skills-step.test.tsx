import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SkillsStep } from '@/components/cv-steps/skills-step'
import { renderWithForm } from '../../utils/test-utils'

describe('SkillsStep', () => {
  test('renders all skill categories', () => {
    renderWithForm(<SkillsStep />)
    
    // Should render all three skill categories
    expect(screen.getByText('Technical Skills')).toBeInTheDocument()
    expect(screen.getByText('Languages')).toBeInTheDocument()
    expect(screen.getByText('Soft Skills')).toBeInTheDocument()
    
    // Should render input fields with appropriate placeholders
    expect(screen.getByPlaceholderText(/javascript, python, react/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/english.*native.*arabic.*fluent/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/leadership, communication, problem solving/i)).toBeInTheDocument()
    
    // Should render "Add" buttons for each category
    expect(screen.getAllByRole('button', { name: /add/i })).toHaveLength(3)
  })

  test('adds technical skills when Add button is clicked', async () => {
    const user = userEvent.setup()
    renderWithForm(<SkillsStep />)
    
    const technicalInput = screen.getByPlaceholderText(/javascript, python, react/i)
    const addButton = screen.getAllByRole('button', { name: /add/i })[0]
    
    // Add a technical skill
    await user.type(technicalInput, 'JavaScript')
    await user.click(addButton)
    
    // Should display the skill as a tag
    expect(screen.getByText('JavaScript')).toBeInTheDocument()
    
    // Input should be cleared
    expect(technicalInput).toHaveValue('')
  })

  test('adds skills using Enter key', async () => {
    const user = userEvent.setup()
    renderWithForm(<SkillsStep />)
    
    const languagesInput = screen.getByPlaceholderText(/english.*native.*arabic.*fluent/i)
    
    // Add a language skill using Enter key
    await user.type(languagesInput, 'English (Native)')
    await user.keyboard('{Enter}')
    
    // Should display the skill as a tag
    expect(screen.getByText('English (Native)')).toBeInTheDocument()
    
    // Input should be cleared
    expect(languagesInput).toHaveValue('')
  })

  test('adds multiple skills to same category', async () => {
    const user = userEvent.setup()
    renderWithForm(<SkillsStep />)
    
    const softSkillsInput = screen.getByPlaceholderText(/leadership, communication, problem solving/i)
    const addButton = screen.getAllByRole('button', { name: /add/i })[2]
    
    // Add multiple soft skills
    await user.type(softSkillsInput, 'Leadership')
    await user.click(addButton)
    
    await user.type(softSkillsInput, 'Communication')
    await user.click(addButton)
    
    await user.type(softSkillsInput, 'Problem Solving')
    await user.click(addButton)
    
    // Should display all three skills
    expect(screen.getByText('Leadership')).toBeInTheDocument()
    expect(screen.getByText('Communication')).toBeInTheDocument()
    expect(screen.getByText('Problem Solving')).toBeInTheDocument()
  })

  test('removes skills when X button is clicked', async () => {
    const user = userEvent.setup()
    renderWithForm(<SkillsStep />)
    
    const technicalInput = screen.getByPlaceholderText(/javascript, python, react/i)
    const addButton = screen.getAllByRole('button', { name: /add/i })[0]
    
    // Add two skills
    await user.type(technicalInput, 'JavaScript')
    await user.click(addButton)
    
    await user.type(technicalInput, 'Python')
    await user.click(addButton)
    
    // Verify both skills are present
    expect(screen.getByText('JavaScript')).toBeInTheDocument()
    expect(screen.getByText('Python')).toBeInTheDocument()
    
    // Remove the first skill (JavaScript)
    const removeButtons = screen.getAllByRole('button', { name: '' }) // X buttons have no accessible name
    await user.click(removeButtons[0])
    
    // JavaScript should be removed, Python should remain
    expect(screen.queryByText('JavaScript')).not.toBeInTheDocument()
    expect(screen.getByText('Python')).toBeInTheDocument()
  })

  test('does not add empty skills', async () => {
    const user = userEvent.setup()
    renderWithForm(<SkillsStep />)
    
    const technicalInput = screen.getByPlaceholderText(/javascript, python, react/i)
    const addButton = screen.getAllByRole('button', { name: /add/i })[0]
    
    // Try to add empty skill
    await user.click(addButton)
    
    // No skill tags should be visible
    expect(screen.queryByRole('button', { name: '' })).not.toBeInTheDocument()
  })

  test('trims whitespace from skills', async () => {
    const user = userEvent.setup()
    renderWithForm(<SkillsStep />)
    
    const technicalInput = screen.getByPlaceholderText(/javascript, python, react/i)
    const addButton = screen.getAllByRole('button', { name: /add/i })[0]
    
    // Add skill with leading/trailing whitespace
    await user.type(technicalInput, '  JavaScript  ')
    await user.click(addButton)
    
    // Should display trimmed skill
    expect(screen.getByText('JavaScript')).toBeInTheDocument()
    expect(screen.queryByText('  JavaScript  ')).not.toBeInTheDocument()
  })

  test('manages skills independently across categories', async () => {
    const user = userEvent.setup()
    renderWithForm(<SkillsStep />)
    
    const technicalInput = screen.getByPlaceholderText(/javascript, python, react/i)
    const languagesInput = screen.getByPlaceholderText(/english.*native.*arabic.*fluent/i)
    const softSkillsInput = screen.getByPlaceholderText(/leadership, communication, problem solving/i)
    
    const addButtons = screen.getAllByRole('button', { name: /add/i })
    
    // Add one skill to each category
    await user.type(technicalInput, 'React')
    await user.click(addButtons[0])
    
    await user.type(languagesInput, 'Arabic')
    await user.click(addButtons[1])
    
    await user.type(softSkillsInput, 'Teamwork')
    await user.click(addButtons[2])
    
    // All skills should be present
    expect(screen.getByText('React')).toBeInTheDocument()
    expect(screen.getByText('Arabic')).toBeInTheDocument()
    expect(screen.getByText('Teamwork')).toBeInTheDocument()
    
    // Remove skill from technical category
    const removeButtons = screen.getAllByRole('button', { name: '' })
    await user.click(removeButtons[0]) // Remove React
    
    // Only React should be removed
    expect(screen.queryByText('React')).not.toBeInTheDocument()
    expect(screen.getByText('Arabic')).toBeInTheDocument()
    expect(screen.getByText('Teamwork')).toBeInTheDocument()
  })

  test('preserves skills when switching between categories', async () => {
    const user = userEvent.setup()
    renderWithForm(<SkillsStep />)
    
    const technicalInput = screen.getByPlaceholderText(/javascript, python, react/i)
    const languagesInput = screen.getByPlaceholderText(/english.*native.*arabic.*fluent/i)
    
    const addButtons = screen.getAllByRole('button', { name: /add/i })
    
    // Add skills to both categories
    await user.type(technicalInput, 'TypeScript')
    await user.click(addButtons[0])
    
    await user.type(languagesInput, 'English')
    await user.click(addButtons[1])
    
    // Add more skills
    await user.type(technicalInput, 'Node.js')
    await user.click(addButtons[0])
    
    // All skills should be preserved
    expect(screen.getByText('TypeScript')).toBeInTheDocument()
    expect(screen.getByText('English')).toBeInTheDocument()
    expect(screen.getByText('Node.js')).toBeInTheDocument()
  })

  test('input fields maintain separate state', async () => {
    const user = userEvent.setup()
    renderWithForm(<SkillsStep />)
    
    const technicalInput = screen.getByPlaceholderText(/javascript, python, react/i)
    const languagesInput = screen.getByPlaceholderText(/english.*native.*arabic.*fluent/i)
    const softSkillsInput = screen.getByPlaceholderText(/leadership, communication, problem solving/i)
    
    // Type in all inputs without adding
    await user.type(technicalInput, 'JavaScript')
    await user.type(languagesInput, 'Arabic')
    await user.type(softSkillsInput, 'Leadership')
    
    // Each input should have its respective value
    expect(technicalInput).toHaveValue('JavaScript')
    expect(languagesInput).toHaveValue('Arabic')
    expect(softSkillsInput).toHaveValue('Leadership')
    
    // Add from technical input
    const addButtons = screen.getAllByRole('button', { name: /add/i })
    await user.click(addButtons[0])
    
    // Only technical input should be cleared
    expect(technicalInput).toHaveValue('')
    expect(languagesInput).toHaveValue('Arabic')
    expect(softSkillsInput).toHaveValue('Leadership')
  })

  test('handles form context correctly', () => {
    renderWithForm(<SkillsStep />, {
      defaultValues: {
        skills: {
          technical: ['React', 'TypeScript'],
          languages: ['English', 'Arabic'],
          soft: ['Leadership']
        }
      }
    })
    
    // Should display pre-existing skills
    expect(screen.getByText('React')).toBeInTheDocument()
    expect(screen.getByText('TypeScript')).toBeInTheDocument()
    expect(screen.getByText('English')).toBeInTheDocument()
    expect(screen.getByText('Arabic')).toBeInTheDocument()
    expect(screen.getByText('Leadership')).toBeInTheDocument()
  })
})
