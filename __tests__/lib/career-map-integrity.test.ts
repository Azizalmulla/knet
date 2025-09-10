import { 
  careerMapRows, 
  getFields, 
  getAreasForField, 
  matchSuggestedVacancies,
  findRowForAudit 
} from '@/lib/career-map'

describe('Career Map Data Integrity', () => {
  describe('Data Structure Validation', () => {
    test('should have all required properties in careerMapRows', () => {
      expect(careerMapRows).toBeDefined()
      expect(Array.isArray(careerMapRows)).toBe(true)
      expect(careerMapRows.length).toBeGreaterThan(0)

      careerMapRows.forEach((row, index) => {
        expect(row).toHaveProperty('Field of Study')
        expect(row).toHaveProperty('Area of Interest')
        expect(row).toHaveProperty('Suggested Vacancies')
        
        expect(typeof row['Field of Study']).toBe('string')
        expect(typeof row['Area of Interest']).toBe('string')
        expect(typeof row['Suggested Vacancies']).toBe('string')
        
        expect(row['Field of Study'].length).toBeGreaterThan(0)
        expect(row['Area of Interest'].length).toBeGreaterThan(0)
        expect(row['Suggested Vacancies'].length).toBeGreaterThan(0)
      })
    })

    test('should have unique field-area combinations', () => {
      const combinations = new Set()
      const duplicates: string[] = []

      careerMapRows.forEach(row => {
        const key = `${row['Field of Study']}|${row['Area of Interest']}`
        if (combinations.has(key)) {
          duplicates.push(key)
        }
        combinations.add(key)
      })

      expect(duplicates).toEqual([])
    })
  })

  describe('getFields() Function Integrity', () => {
    test('should return all unique fields from careerMapRows', () => {
      const fields = getFields()
      const expectedFields = Array.from(new Set(careerMapRows.map(r => r['Field of Study'])))
      
      expect(fields).toEqual(expectedFields)
      expect(fields.length).toBe(expectedFields.length)
    })

    test('should include all expected field values', () => {
      const fields = getFields()
      
      // Verify core fields exist
      expect(fields).toContain('Business Management')
      expect(fields).toContain('Computer Engineering/Computer Science/Technology')
      expect(fields).toContain('Finance and Accounting')
      expect(fields).toContain('Media/Marketing/PR')
      expect(fields).toContain('Others ')
      
      // No field should be empty
      fields.forEach(field => {
        expect(field.trim().length).toBeGreaterThan(0)
      })
    })

    test('should be deterministic and consistent', () => {
      const fields1 = getFields()
      const fields2 = getFields()
      
      expect(fields1).toEqual(fields2)
    })
  })

  describe('getAreasForField() Function Integrity', () => {
    test('should return all areas for Computer Engineering field', () => {
      const field = 'Computer Engineering/Computer Science/Technology'
      const areas = getAreasForField(field)
      
      expect(areas).toContain('Operations')
      expect(areas).toContain('Digital Transformation & Innovation')
      expect(areas).toContain('Supply Chain')
      expect(areas).toContain('Project Management\u00a0')
      expect(areas).toContain('Audit')
      expect(areas).toContain('Risk Management')
      expect(areas).toContain('Information Security')
      expect(areas).toContain('Fraud Management ')
      expect(areas).toContain('IT')
      expect(areas).toContain('Security Operations ')
      
      // Should not contain duplicates
      const uniqueAreas = Array.from(new Set(areas))
      expect(areas.length).toBe(uniqueAreas.length)
    })

    test('should return areas for Business Management field', () => {
      const field = 'Business Management'
      const areas = getAreasForField(field)
      
      expect(areas).toContain('Operations')
      expect(areas).toContain('Customer Care')
      expect(areas).toContain('Business Development')
      expect(areas).toContain('Digital Transformation & Innovation')
      expect(areas).toContain('HR')
      expect(areas).toContain('Project Management\u00a0')
      expect(areas).toContain('Strategy')
    })

    test('should return empty array for non-existent field', () => {
      const areas = getAreasForField('Non-Existent Field')
      expect(areas).toEqual([])
    })

    test('should handle fields with exact string matching', () => {
      // Test case sensitivity and spacing
      const exactField = 'Computer Engineering/Computer Science/Technology'
      const areas1 = getAreasForField(exactField)
      const areas2 = getAreasForField('computer engineering/computer science/technology')
      
      expect(areas1.length).toBeGreaterThan(0)
      expect(areas2).toEqual([]) // Should be case sensitive
    })
  })

  describe('matchSuggestedVacancies() Function Integrity', () => {
    test('should return exact vacancy string for valid field-area pairs', () => {
      const testCases = [
        {
          field: 'Business Management',
          area: 'Operations',
          expected: 'Bank Operations'
        },
        {
          field: 'Computer Engineering/Computer Science/Technology',
          area: 'Operations',
          expected: 'Payment Operations/Core Operations'
        },
        {
          field: 'Business Management',
          area: 'Customer Care',
          expected: 'Customer Care/Disputes Management/Customer Experience Management'
        },
        {
          field: 'Computer Engineering/Computer Science/Technology',
          area: 'IT',
          expected: 'Development/System Excellence/Application Support/Network Management/Data & Server Management/IT Support Center'
        }
      ]

      testCases.forEach(({ field, area, expected }) => {
        const result = matchSuggestedVacancies(field, area)
        expect(result).toBe(expected)
      })
    })

    test('should return null for invalid combinations', () => {
      const invalidCases = [
        { field: 'Invalid Field', area: 'Operations' },
        { field: 'Business Management', area: 'Invalid Area' },
        { field: 'Invalid Field', area: 'Invalid Area' },
        { field: '', area: '' }
      ]

      invalidCases.forEach(({ field, area }) => {
        const result = matchSuggestedVacancies(field, area)
        expect(result).toBeNull()
      })
    })

    test('should handle whitespace variations correctly', () => {
      // Test areas with non-breaking space (\u00a0) - actual data has this
      const result1 = matchSuggestedVacancies('Finance and Accounting', 'Finance\u00a0')
      expect(result1).toBe('Finance/Accounting')

      const result2 = matchSuggestedVacancies('Business Management', 'Project Management\u00a0')
      expect(result2).toBe('Project Development')

      // Areas without trailing space should return null if data has trailing space
      const result3 = matchSuggestedVacancies('Finance and Accounting', 'Finance')
      expect(result3).toBeNull()
      
      const result4 = matchSuggestedVacancies('Business Management', 'Project Management')
      expect(result4).toBeNull()
    })

    test('should preserve exact vacancy strings with typos', () => {
      // The data contains intentional typos that should be preserved
      const result1 = matchSuggestedVacancies(
        'Finance and Accounting', 
        'Digital Transformation & Innovation'
      )
      expect(result1).toBe('Business Intellegence') // Note: "Intellegence" typo preserved

      const result2 = matchSuggestedVacancies(
        'Computer Engineering/Computer Science/Technology',
        'Audit'
      )
      expect(result2).toBe('IT Aduit') // Note: "Aduit" typo preserved
    })
  })

  describe('Complete Data Coverage', () => {
    test('should ensure every row is reachable through UI flow', () => {
      const unreachableRows: typeof careerMapRows[0][] = []

      careerMapRows.forEach(row => {
        const field = row['Field of Study']
        const area = row['Area of Interest']
        
        // Check if field appears in getFields()
        const availableFields = getFields()
        if (!availableFields.includes(field)) {
          unreachableRows.push(row)
          return
        }
        
        // Check if area appears in getAreasForField(field)
        const availableAreas = getAreasForField(field)
        if (!availableAreas.includes(area)) {
          unreachableRows.push(row)
          return
        }
        
        // Check if matchSuggestedVacancies returns the correct value
        const matchedVacancy = matchSuggestedVacancies(field, area)
        if (matchedVacancy !== row['Suggested Vacancies']) {
          unreachableRows.push(row)
        }
      })

      expect(unreachableRows).toEqual([])
    })

    test('should have consistent field-area-vacancy mapping', () => {
      const inconsistencies: string[] = []

      careerMapRows.forEach(row => {
        const field = row['Field of Study']
        const area = row['Area of Interest']
        const expectedVacancy = row['Suggested Vacancies']
        
        const actualVacancy = matchSuggestedVacancies(field, area)
        
        if (actualVacancy !== expectedVacancy) {
          inconsistencies.push(
            `Field: "${field}", Area: "${area}" - Expected: "${expectedVacancy}", Got: "${actualVacancy}"`
          )
        }
      })

      expect(inconsistencies).toEqual([])
    })

    test('should validate "Others" field special case', () => {
      const othersRows = careerMapRows.filter(row => row['Field of Study'] === 'Others ')
      expect(othersRows.length).toBe(1)
      
      const othersRow = othersRows[0]
      expect(othersRow['Area of Interest']).toBe('(as per the ebove)') // Preserve typo
      expect(othersRow['Suggested Vacancies']).toBe('(to be as er the area of interest and suggested vacancy)') // Preserve typos
    })
  })

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty string inputs gracefully', () => {
      expect(getAreasForField('')).toEqual([])
      expect(matchSuggestedVacancies('', '')).toBeNull()
      expect(matchSuggestedVacancies('Business Management', '')).toBeNull()
      expect(matchSuggestedVacancies('', 'Operations')).toBeNull()
    })

    test('should handle null and undefined inputs', () => {
      expect(getAreasForField(null as any)).toEqual([])
      expect(getAreasForField(undefined as any)).toEqual([])
      expect(matchSuggestedVacancies(null as any, null as any)).toBeNull()
      expect(matchSuggestedVacancies(undefined as any, undefined as any)).toBeNull()
    })

    test('should be case sensitive for exact matching', () => {
      const field = 'business management' // lowercase
      const area = 'operations' // lowercase
      
      expect(getAreasForField(field)).toEqual([])
      expect(matchSuggestedVacancies(field, area)).toBeNull()
    })
  })

  describe('Performance and Scalability', () => {
    test('should perform field lookups efficiently', () => {
      const startTime = performance.now()
      
      // Perform multiple lookups
      for (let i = 0; i < 1000; i++) {
        getFields()
      }
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // Should complete 1000 lookups in under 100ms
      expect(duration).toBeLessThan(100)
    })

    test('should perform area lookups efficiently', () => {
      const startTime = performance.now()
      
      for (let i = 0; i < 1000; i++) {
        getAreasForField('Computer Engineering/Computer Science/Technology')
      }
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      expect(duration).toBeLessThan(100)
    })

    test('should perform vacancy matching efficiently', () => {
      const startTime = performance.now()
      
      for (let i = 0; i < 1000; i++) {
        matchSuggestedVacancies('Business Management', 'Operations')
      }
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      expect(duration).toBeLessThan(100)
    })
  })

  describe('Data Quality Validation', () => {
    test('should validate no empty or whitespace-only values', () => {
      const emptyValues: string[] = []
      
      careerMapRows.forEach((row, index) => {
        if (!row['Field of Study'].trim()) {
          emptyValues.push(`Row ${index}: Empty Field of Study`)
        }
        if (!row['Area of Interest'].trim()) {
          emptyValues.push(`Row ${index}: Empty Area of Interest`)
        }
        if (!row['Suggested Vacancies'].trim()) {
          emptyValues.push(`Row ${index}: Empty Suggested Vacancies`)
        }
      })
      
      expect(emptyValues).toEqual([])
    })

    test('should have consistent data format', () => {
      careerMapRows.forEach((row, index) => {
        // Check for common formatting issues - allow "Others " with trailing space as it's intentional
        if (row['Field of Study'] !== 'Others ') {
          expect(row['Field of Study']).not.toMatch(/^\s+|\s+$/)
        }
        expect(row['Area of Interest']).toBeDefined()
        expect(row['Suggested Vacancies']).toBeDefined()
        
        // Vacancy strings should use '/' as separator for multiple values
        if (row['Suggested Vacancies'].includes('/')) {
          const vacancies = row['Suggested Vacancies'].split('/')
          expect(vacancies.length).toBeGreaterThan(1)
          
          // Each vacancy should not be empty
          vacancies.forEach(vacancy => {
            expect(vacancy.trim().length).toBeGreaterThan(0)
          })
        }
      })
    })
  })
})
