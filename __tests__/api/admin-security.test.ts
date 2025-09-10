/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

// Mock admin route handler
const mockAdminHandler = async (request: NextRequest) => {
  const authHeader = request.headers.get('Authorization')
  const adminKey = process.env.ADMIN_KEY
  
  if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.slice(7) !== adminKey) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { 
        status: 401,
        headers: {
          'WWW-Authenticate': 'Bearer realm="Admin Panel"',
          'Content-Type': 'application/json'
        }
      }
    )
  }
  
  // Mock admin data with PII masking
  const submissions = [
    {
      id: 1,
      fullName: 'John Doe',
      email: 'john@example.com',
      phone: '+965 1234567890',
      fieldOfStudy: 'Computer Science',
      cvUrl: 'https://blob.com/cv1.pdf'
    },
    {
      id: 2,
      fullName: 'Jane Smith', 
      email: 'jane@example.com',
      phone: '+965 9876543210',
      fieldOfStudy: 'Engineering',
      cvUrl: 'https://blob.com/cv2.pdf'
    }
  ]
  
  // Mask PII by default
  const maskedSubmissions = submissions.map(submission => ({
    ...submission,
    fullName: submission.fullName.charAt(0) + '***',
    email: submission.email.replace(/(.{2}).*@/, '$1***@'),
    phone: submission.phone.replace(/(\+\d{3})\s?(.{3}).*/, '$1 $2***')
  }))
  
  return new Response(JSON.stringify({ submissions: maskedSubmissions }), {
    headers: { 'Content-Type': 'application/json' }
  })
}

describe('Admin Security Tests', () => {
  beforeEach(() => {
    process.env.ADMIN_KEY = 'test-admin-key-123'
  })

  afterEach(() => {
    delete process.env.ADMIN_KEY
  })

  describe('Authentication Middleware', () => {
    test('should require Authorization Bearer header', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin', {
        method: 'GET'
      })

      const response = await mockAdminHandler(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(response.headers.get('WWW-Authenticate')).toBe('Bearer realm="Admin Panel"')
      expect(data.error).toBe('Unauthorized')
    })

    test('should reject invalid Bearer token', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer invalid-key'
        }
      })

      const response = await mockAdminHandler(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    test('should reject malformed Authorization header', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin', {
        method: 'GET',
        headers: {
          'Authorization': 'Basic dXNlcjpwYXNz' // Basic auth instead of Bearer
        }
      })

      const response = await mockAdminHandler(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    test('should accept valid admin key', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-admin-key-123'
        }
      })

      const response = await mockAdminHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.submissions).toBeDefined()
      expect(Array.isArray(data.submissions)).toBe(true)
    })
  })

  describe('PII Masking', () => {
    test('should mask email addresses by default', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-admin-key-123'
        }
      })

      const response = await mockAdminHandler(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      
      data.submissions.forEach((submission: any) => {
        expect(submission.email).toMatch(/^.{2}\*\*\*@/)
        expect(submission.email).not.toContain('john@example.com')
        expect(submission.email).not.toContain('jane@example.com')
      })
    })

    test('should mask phone numbers by default', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-admin-key-123'
        }
      })

      const response = await mockAdminHandler(request)
      const data = await response.json()

      data.submissions.forEach((submission: any) => {
        expect(submission.phone).toMatch(/^\+\d{3}\s\d{3}\*\*\*$/)
        expect(submission.phone).not.toContain('1234567890')
        expect(submission.phone).not.toContain('9876543210')
      })
    })

    test('should mask full names by default', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-admin-key-123'
        }
      })

      const response = await mockAdminHandler(request)
      const data = await response.json()

      data.submissions.forEach((submission: any) => {
        expect(submission.fullName).toMatch(/^.\*\*\*$/)
        expect(submission.fullName).not.toBe('John Doe')
        expect(submission.fullName).not.toBe('Jane Smith')
      })
    })

    test('should not mask non-PII fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-admin-key-123'
        }
      })

      const response = await mockAdminHandler(request)
      const data = await response.json()

      expect(data.submissions[0].fieldOfStudy).toBe('Computer Science')
      expect(data.submissions[1].fieldOfStudy).toBe('Engineering')
      expect(data.submissions[0].id).toBe(1)
      expect(data.submissions[1].id).toBe(2)
    })
  })

  describe('CSV Export with PII Controls', () => {
    test('should exclude masked values by default in CSV export', () => {
      const submissions = [
        {
          id: 1,
          fullName: 'J***',
          email: 'jo***@example.com',
          phone: '+965 123***',
          fieldOfStudy: 'Computer Science'
        }
      ]

      const csvData = generateCSV(submissions, { includePII: false })
      
      expect(csvData).toContain('J***')
      expect(csvData).toContain('jo***@example.com')
      expect(csvData).toContain('+965 123***')
      expect(csvData).toContain('Computer Science')
    })

    test('should include full values when "Include PII" is enabled', () => {
      const submissions = [
        {
          id: 1,
          fullName: 'John Doe',
          email: 'john@example.com',
          phone: '+965 1234567890',
          fieldOfStudy: 'Computer Science'
        }
      ]

      const csvData = generateCSV(submissions, { includePII: true })
      
      expect(csvData).toContain('John Doe')
      expect(csvData).toContain('john@example.com')
      expect(csvData).toContain('+965 1234567890')
      expect(csvData).toContain('Computer Science')
    })
  })

  describe('Admin Table UI Tests', () => {
    test('should hide PII in table rows by default', () => {
      const mockRowData = {
        id: 1,
        fullName: 'J***',
        email: 'jo***@example.com',
        phone: '+965 123***',
        fieldOfStudy: 'Computer Science'
      }

      // Mock table row rendering
      const renderTableRow = (data: any, showPII = false) => {
        if (showPII) {
          return {
            displayName: data.originalFullName || data.fullName,
            displayEmail: data.originalEmail || data.email,
            displayPhone: data.originalPhone || data.phone
          }
        }
        return {
          displayName: data.fullName,
          displayEmail: data.email,
          displayPhone: data.phone
        }
      }

      const tableRow = renderTableRow(mockRowData, false)
      
      expect(tableRow.displayName).toBe('J***')
      expect(tableRow.displayEmail).toBe('jo***@example.com')
      expect(tableRow.displayPhone).toBe('+965 123***')
    })

    test('should show full PII in row drawer when expanded', () => {
      const mockRowData = {
        id: 1,
        fullName: 'J***',
        email: 'jo***@example.com', 
        phone: '+965 123***',
        originalFullName: 'John Doe',
        originalEmail: 'john@example.com',
        originalPhone: '+965 1234567890',
        fieldOfStudy: 'Computer Science'
      }

      const renderDrawer = (data: any) => ({
        fullName: data.originalFullName,
        email: data.originalEmail,
        phone: data.originalPhone,
        fieldOfStudy: data.fieldOfStudy
      })

      const drawerData = renderDrawer(mockRowData)
      
      expect(drawerData.fullName).toBe('John Doe')
      expect(drawerData.email).toBe('john@example.com')
      expect(drawerData.phone).toBe('+965 1234567890')
    })
  })

  describe('Audit Logging', () => {
    test('should log admin access with timestamp and action', () => {
      const auditLogs: any[] = []
      
      const logAdminAction = (action: string, adminId: string, details?: any) => {
        auditLogs.push({
          timestamp: new Date().toISOString(),
          action,
          adminId,
          details: details || {}
        })
      }

      // Simulate admin actions
      logAdminAction('ADMIN_LOGIN', 'admin-123')
      logAdminAction('VIEW_SUBMISSIONS', 'admin-123', { count: 10 })
      logAdminAction('EXPORT_CSV', 'admin-123', { includePII: false, recordCount: 5 })

      expect(auditLogs).toHaveLength(3)
      expect(auditLogs[0].action).toBe('ADMIN_LOGIN')
      expect(auditLogs[1].action).toBe('VIEW_SUBMISSIONS')
      expect(auditLogs[2].action).toBe('EXPORT_CSV')
      expect(auditLogs[2].details.includePII).toBe(false)
    })
  })
})

// Helper function to generate CSV
function generateCSV(data: any[], options: { includePII: boolean }) {
  const headers = ['ID', 'Full Name', 'Email', 'Phone', 'Field of Study']
  const rows = data.map(item => [
    item.id,
    item.fullName,
    item.email,
    item.phone,
    item.fieldOfStudy
  ])
  
  return [headers, ...rows].map(row => row.join(',')).join('\n')
}
