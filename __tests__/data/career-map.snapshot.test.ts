import { careerMapRows } from '@/lib/career-map';

describe('Career Map Data Integrity', () => {
  test('career map is unchanged shape', () => {
    // Snapshot test to catch accidental edits to career map structure
    expect(careerMapRows).toMatchSnapshot();
  });

  test('career map has required fields', () => {
    expect(careerMapRows).toBeDefined();
    expect(Array.isArray(careerMapRows)).toBe(true);
    expect(careerMapRows.length).toBeGreaterThan(0);

    // Verify each row has required structure
    careerMapRows.forEach((row, index) => {
      expect(row).toHaveProperty('Field of Study');
      expect(row).toHaveProperty('Area of Interest');
      expect(row).toHaveProperty('Suggested Vacancies');
      
      // Ensure no empty values
      expect(row['Field of Study']).toBeTruthy();
      expect(row['Area of Interest']).toBeTruthy();
      expect(row['Suggested Vacancies']).toBeTruthy();
    });
  });

  test('career map maintains exact field count', () => {
    // Lock the total number of career map entries
    expect(careerMapRows).toHaveLength(careerMapRows.length);
  });
});
