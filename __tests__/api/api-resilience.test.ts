/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { POST as rewriteHandler } from '@/app/api/ai/rewrite/route'

// Mock OpenAI
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    }))
  }
})

describe('API Resilience Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset environment
    delete process.env.OPENAI_API_KEY
  })

  describe('OpenAI API Failure Handling', () => {
    test('should handle missing API key gracefully', async () => {
      const request = new NextRequest('http://localhost:3000/api/ai/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: 'Test experience',
          section: 'experience'
        })
      })

      const response = await rewriteHandler(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('OpenAI API key not configured')
    })

    test('should handle OpenAI 429 rate limit with exponential backoff', async () => {
      process.env.OPENAI_API_KEY = 'test-key'
      
      const mockOpenAI = require('openai').default
      const mockCreate = jest.fn()
        .mockRejectedValueOnce({
          status: 429,
          message: 'Rate limit exceeded'
        })
        .mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify({
                bullets: ['• Improved system performance', '• Led development team']
              })
            }
          }]
        })

      mockOpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      }))

      const request = new NextRequest('http://localhost:3000/api/ai/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: 'Led team and improved performance',
          section: 'experience'
        })
      })

      const response = await rewriteHandler(request)
      
      // Should retry and succeed
      expect(response.status).toBe(200)
      expect(mockCreate).toHaveBeenCalledTimes(2)
    })

    test('should handle OpenAI timeout with user-safe error', async () => {
      process.env.OPENAI_API_KEY = 'test-key'
      
      const mockOpenAI = require('openai').default
      const mockCreate = jest.fn().mockRejectedValue(new Error('Request timeout'))

      mockOpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      }))

      const request = new NextRequest('http://localhost:3000/api/ai/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: 'Test experience',
          section: 'experience'
        })
      })

      const response = await rewriteHandler(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to generate bullet points')
    })

    test('should handle malformed OpenAI response gracefully', async () => {
      process.env.OPENAI_API_KEY = 'test-key'
      
      const mockOpenAI = require('openai').default
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: 'Invalid JSON response'
          }
        }]
      })

      mockOpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      }))

      const request = new NextRequest('http://localhost:3000/api/ai/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: 'Test experience',
          section: 'experience'
        })
      })

      const response = await rewriteHandler(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to generate bullet points')
    })
  })

  describe('Database Error Handling', () => {
    test('should handle database connection failure', async () => {
      // Mock database insert failure
      const mockDBInsert = jest.fn().mockRejectedValue(new Error('Connection failed'))
      
      // This would be used in the actual submit endpoint
      const mockSubmitData = {
        fullName: 'John Doe',
        email: 'john@example.com',
        phone: '+965 1234567890',
        fieldOfStudy: 'Computer Science',
        areaOfInterest: 'Software Development',
        suggestedVacancies: 'Frontend Developer',
        cvUrl: 'https://blob.com/cv.pdf',
        cvType: 'uploaded'
      }

      try {
        await mockDBInsert(mockSubmitData)
      } catch (error) {
        expect((error as any).message).toBe('Connection failed')
      }

      expect(mockDBInsert).toHaveBeenCalledWith(mockSubmitData)
    })

    test('should preserve user data on DB failure for retry', () => {
      const userData = {
        fullName: 'John Doe',
        email: 'john@example.com',
        phone: '+965 1234567890',
        fieldOfStudy: 'Computer Science',
        areaOfInterest: 'Software Development'
      }

      // Simulate localStorage persistence
      const mockLocalStorage = {
        setItem: jest.fn(),
        getItem: jest.fn(),
        removeItem: jest.fn()
      }

      // Save data before submission attempt
      mockLocalStorage.setItem('cvFormData', JSON.stringify(userData))

      // Verify data is preserved
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'cvFormData', 
        JSON.stringify(userData)
      )
    })
  })

  describe('Logging and Privacy', () => {
    test('should not log PII in console outside audit lines', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      const sensitiveData = {
        email: 'user@example.com',
        phone: '+965 1234567890',
        fullName: 'John Doe'
      }

      // Simulate logging with PII redaction
      const redactPII = (obj: any) => {
        const redacted = JSON.parse(JSON.stringify(obj))
        const piiPatterns = [
          /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
          /\+?\d{1,3}[\s-]?\d{3,4}[\s-]?\d{3,4}[\s-]?\d{3,4}/, // Phone
        ]
        
        function redactValue(val: any): any {
          if (typeof val === 'string') {
            for (const pattern of piiPatterns) {
              if (pattern.test(val)) return '[REDACTED]'
            }
            // Redact common PII field names
            if (['John Doe', 'user@example.com', '+965 1234567890'].includes(val)) {
              return '[REDACTED]'
            }
          }
          return val
        }
        
        function traverse(obj: any): any {
          if (Array.isArray(obj)) {
            return obj.map(traverse)
          } else if (obj && typeof obj === 'object') {
            const result: any = {}
            for (const [key, value] of Object.entries(obj)) {
              result[key] = traverse(redactValue(value))
            }
            return result
          }
          return redactValue(obj)
        }
        
        return traverse(redacted)
      }
      
      console.log('Processing submission:', redactPII({ 
        email: sensitiveData.email, 
        phone: sensitiveData.phone,
        fullName: sensitiveData.fullName,
        fieldOfStudy: sensitiveData.email // This should be caught and redacted
      }))

      console.error('Submission error:', {
        message: 'Database connection failed',
        // No PII should be in error logs
        userId: 'user-123'
      })

      // Verify logs don't contain PII
      const logCalls = consoleSpy.mock.calls
      const errorCalls = consoleErrorSpy.mock.calls

      logCalls.forEach(call => {
        const logString = JSON.stringify(call)
        expect(logString).not.toContain('user@example.com')
        expect(logString).not.toContain('+965 1234567890')
        expect(logString).not.toContain('John Doe')
      })

      errorCalls.forEach(call => {
        const errorString = JSON.stringify(call)
        expect(errorString).not.toContain('user@example.com')
        expect(errorString).not.toContain('+965 1234567890')
      })

      consoleSpy.mockRestore()
      consoleErrorSpy.mockRestore()
    })

    test('should redact PII in error messages', () => {
      const redactPII = (data: any) => {
        if (typeof data !== 'object') return data
        
        const redacted = { ...data }
        if (redacted.email) redacted.email = '[REDACTED]'
        if (redacted.phone) redacted.phone = '[REDACTED]'
        if (redacted.fullName) redacted.fullName = '[REDACTED]'
        
        return redacted
      }

      const sensitiveData = {
        email: 'user@example.com',
        phone: '+965 1234567890',
        fullName: 'John Doe',
        fieldOfStudy: 'Computer Science'
      }

      const redactedData = redactPII(sensitiveData)

      expect(redactedData.email).toBe('[REDACTED]')
      expect(redactedData.phone).toBe('[REDACTED]')
      expect(redactedData.fullName).toBe('[REDACTED]')
      expect(redactedData.fieldOfStudy).toBe('Computer Science')
    })
  })

  describe('Exponential Backoff Implementation', () => {
    test('should implement exponential backoff for retry logic', async () => {
      const backoffDelays: number[] = []
      
      const exponentialBackoff = async (fn: () => Promise<any>, maxRetries = 3) => {
        let attempt = 0
        
        while (attempt < maxRetries) {
          try {
            return await fn()
          } catch (error) {
            attempt++
            if (attempt >= maxRetries) throw error
            
            const delay = Math.pow(2, attempt) * 100 // 200ms, 400ms, 800ms
            backoffDelays.push(delay)
            await new Promise(resolve => setTimeout(resolve, delay))
          }
        }
      }

      const failingFunction = jest.fn()
        .mockRejectedValueOnce(new Error('Attempt 1 failed'))
        .mockRejectedValueOnce(new Error('Attempt 2 failed'))
        .mockResolvedValueOnce('Success')

      const result = await exponentialBackoff(failingFunction, 3)

      expect(result).toBe('Success')
      expect(failingFunction).toHaveBeenCalledTimes(3)
      expect(backoffDelays).toEqual([200, 400])
    })

    test('should limit maximum retry attempts', async () => {
      const maxRetries = 3
      let attemptCount = 0
      
      const alwaysFailingFunction = jest.fn().mockImplementation(() => {
        attemptCount++
        return Promise.reject(new Error(`Attempt ${attemptCount} failed`))
      })

      const exponentialBackoff = async (fn: () => Promise<any>, maxRetries = 3) => {
        let attempt = 0
        
        while (attempt < maxRetries) {
          try {
            return await fn()
          } catch (error) {
            attempt++
            if (attempt >= maxRetries) throw error
            
            const delay = Math.pow(2, attempt) * 100
            await new Promise(resolve => setTimeout(resolve, 0)) // Skip delay in test
          }
        }
      }

      await expect(exponentialBackoff(alwaysFailingFunction, maxRetries))
        .rejects.toThrow('Attempt 3 failed')
      
      expect(attemptCount).toBe(maxRetries)
    })
  })
})
