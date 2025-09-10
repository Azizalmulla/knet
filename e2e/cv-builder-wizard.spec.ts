import { test, expect } from '@playwright/test';

test.describe('CV Builder Wizard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ai-builder');
  });

  test.describe('Happy Path', () => {
    test('should complete full wizard flow without validation errors', async ({ page }) => {
      // Step 1: Personal Info
      await expect(page.getByTestId('step-title')).toHaveText('Personal Info');
      
      await page.getByTestId('field-fullName').fill('John Doe');
      await page.getByTestId('field-email').fill('john@example.com');
      await page.getByTestId('field-phone').fill('+965 1234567890');
      await page.getByTestId('field-location').fill('Kuwait City, Kuwait');
      
      // Verify no "Required" errors visible
      await expect(page.getByText(/required/i)).not.toBeVisible();
      
      await page.getByTestId('next-btn').click();
      
      // Step 2: Education
      await expect(page.getByTestId('step-title')).toHaveText('Education');
      
      // Fill minimum required education
      await page.getByTestId('field-education-0-institution').fill('Kuwait University');
      await page.getByTestId('field-education-0-degree').fill('Computer Science');
      await page.getByTestId('field-education-0-field').fill('Software Engineering');
      await page.getByTestId('field-education-0-graduationDate').fill('2020-09');
      
      await expect(page.getByText(/required/i)).not.toBeVisible();
      await page.getByTestId('next-btn').click();
      
      // Step 3: Experience
      await expect(page.getByTestId('step-title')).toHaveText('Experience');
      
      // Add one experience
      await page.getByText('Add Experience').click();
      await page.getByTestId('field-experience-0-company').fill('ACME Corp');
      await page.getByTestId('field-experience-0-position').fill('Frontend Developer');
      await page.getByTestId('field-experience-0-startDate').fill('2021-01');
      
      await expect(page.getByText(/required/i)).not.toBeVisible();
      await page.getByTestId('next-btn').click();
      
      // Step 4: Projects
      await expect(page.getByTestId('step-title')).toHaveText('Projects');
      
      // Add one project
      await page.getByText('Add Project').click();
      await page.getByPlaceholder('My Awesome Project').fill('Portfolio Website');
      await page.getByPlaceholder('Describe what the project does').fill('Personal portfolio built with Next.js');
      
      await expect(page.getByText(/required/i)).not.toBeVisible();
      await page.getByTestId('next-btn').click();
      
      // Step 5: Skills
      await expect(page.getByTestId('step-title')).toHaveText('Skills');
      
      // Add some skills
      await page.getByPlaceholder('JavaScript, Python, React...').fill('React');
      await page.getByText('Add').first().click();
      
      await expect(page.getByText(/required/i)).not.toBeVisible();
      await page.getByTestId('next-btn').click();
      
      // Step 6: Review
      await expect(page.getByTestId('step-title')).toHaveText('Review');
      
      // Fill career mapping fields
      await page.getByTestId('field-fieldOfStudy').click();
      await page.getByRole('option', { name: 'Computer Engineering/Computer Science/Technology' }).click();
      
      await page.getByTestId('field-areaOfInterest').click();
      await page.getByRole('option', { name: 'IT', exact: true }).click();
      
      // Should see suggested vacancies
      await expect(page.getByText(/suggested vacancies/i)).toBeVisible();
      
      // Submit should be enabled
      await expect(page.getByText('Submit')).toBeEnabled();
    });
  });

  test.describe('Validation Guards', () => {
    test('should prevent navigation with empty required fields', async ({ page }) => {
      // Try to advance without filling required fields
      await page.getByTestId('next-btn').click();
      
      // Should show validation errors via aria-invalid
      await expect(page.getByTestId('field-fullName')).toHaveAttribute('aria-invalid', 'true');
      
      // Should stay on Personal Info step
      await expect(page.getByTestId('step-title')).toHaveText('Personal Info');
      await expect(page.getByTestId('step-indicator')).toContainText('Step 1 of 6');
    });

    test('should show validation error for invalid phone then clear when fixed', async ({ page }) => {
      // Fill fields with invalid phone
      await page.getByTestId('field-fullName').fill('John Doe');
      await page.getByTestId('field-email').fill('john@example.com');
      await page.getByTestId('field-phone').fill('123'); // Too short
      await page.getByTestId('field-location').fill('Kuwait City');
      
      await page.getByTestId('next-btn').click();
      
      // Should show error on phone
      await expect(page.getByTestId('field-phone')).toHaveAttribute('aria-invalid', 'true');
      
      // Fix phone
      await page.getByTestId('field-phone').fill('+965 1234567890');
      
      // Error should clear and Next should work
      await page.getByTestId('next-btn').click();
      await expect(page.getByTestId('step-title')).toHaveText('Education');
    });

    test('should validate email format', async ({ page }) => {
      await page.getByTestId('field-email').fill('invalid-email');
      await page.getByTestId('next-btn').click();
      
      await expect(page.getByText(/invalid email/i)).toBeVisible();
      
      // Fix email
      await page.getByTestId('field-email').fill('valid@example.com');
      // Error should clear
      await expect(page.getByText(/invalid email/i)).not.toBeVisible();
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should not bypass validation when pressing Enter', async ({ page }) => {
      const fullNameInput = page.getByTestId('field-fullName');
      
      // Focus input and press Enter
      await fullNameInput.focus();
      await page.keyboard.press('Enter');
      
      // Should not advance step
      await expect(page.getByTestId('step-title')).toHaveText('Personal Info');
      
      // Fill valid data and press Enter
      await fullNameInput.fill('John Doe');
      await page.getByTestId('field-email').fill('john@example.com');
      await page.getByTestId('field-phone').fill('+965 1234567890');
      await page.getByTestId('field-location').fill('Kuwait City');
      
      await page.keyboard.press('Enter');
      
      // Should advance now
      await expect(page.getByTestId('step-title')).toHaveText('Education');
    });
  });

  test.describe('Mobile Viewport', () => {
    test('should work correctly on mobile', async ({ page, isMobile }) => {
      if (!isMobile) {
        await page.setViewportSize({ width: 390, height: 844 }); // iPhone 12
      }
      
      // Fill personal info on mobile
      await page.getByTestId('field-fullName').fill('John Doe');
      await page.getByTestId('field-email').fill('john@example.com');
      await page.getByTestId('field-phone').fill('+965 1234567890');
      await page.getByTestId('field-location').fill('Kuwait City');
      
      // Should show no errors
      await expect(page.getByText(/required/i)).not.toBeVisible();
      
      // Next should work
      await page.getByTestId('next-btn').click();
      await expect(page.getByTestId('step-title')).toHaveText('Education');
    });
  });

  test.describe('Navigation Controls', () => {
    test('should have correct button states', async ({ page }) => {
      // Previous should be disabled on first step
      await expect(page.getByTestId('prev-btn')).toBeDisabled();
      
      // Fill and advance to next step
      await page.getByTestId('field-fullName').fill('John Doe');
      await page.getByTestId('field-email').fill('john@example.com');
      await page.getByTestId('field-phone').fill('+965 1234567890');
      await page.getByTestId('field-location').fill('Kuwait City');
      
      await page.getByTestId('next-btn').click();
      
      // Previous should be enabled
      await expect(page.getByTestId('prev-btn')).toBeEnabled();
      
      // Go back
      await page.getByTestId('prev-btn').click();
      await expect(page.getByTestId('step-title')).toHaveText('Personal Info');
    });
  });

  test.describe('Progress Indicator', () => {
    test('should show correct step progress', async ({ page }) => {
      await expect(page.getByTestId('step-indicator')).toContainText('Step 1 of 6');
      
      // Advance step
      await page.getByTestId('field-fullName').fill('John Doe');
      await page.getByTestId('field-email').fill('john@example.com');
      await page.getByTestId('field-phone').fill('+965 1234567890');
      await page.getByTestId('field-location').fill('Kuwait City');
      
      await page.getByTestId('next-btn').click();
      
      await expect(page.getByTestId('step-indicator')).toContainText('Step 2 of 6');
    });
  });
});
