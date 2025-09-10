import React from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { FormProvider, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { cvSchema, defaultCVValues, type CVData } from '@/lib/cv-schemas'
import { LanguageProvider } from '@/lib/language'

interface RenderWithFormOptions extends Omit<RenderOptions, 'wrapper'> {
  defaultValues?: Partial<CVData>
  formOptions?: any
}

export function renderWithForm(ui: React.ReactNode, options: RenderWithFormOptions = {}) {
  const { defaultValues, formOptions, ...renderOptions } = options
  
  function Wrapper({ children }: { children: React.ReactNode }) {
    const methods = useForm<CVData>({
      resolver: zodResolver(cvSchema),
      defaultValues: { ...defaultCVValues, ...defaultValues },
      mode: 'onChange',
      shouldUnregister: false,
      ...formOptions
    })
    
    return (
      <LanguageProvider>
        <FormProvider {...methods}>{children}</FormProvider>
      </LanguageProvider>
    )
  }
  
  return render(<Wrapper>{ui}</Wrapper>, renderOptions)
}

// Re-export everything from testing-library/react
export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'

// Dummy test to prevent Jest from complaining about no tests
describe('Test Utils', () => {
  test('should export utilities', () => {
    expect(renderWithForm).toBeDefined()
  })
})
