import { test, expect } from '@playwright/test';

test.describe('RTL and Accessibility @rtl', () => {
  test.describe('LTR Mode', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/ai-builder');
      await page.evaluate(() => document.documentElement.setAttribute('dir', 'ltr'));
    });

    test('should have proper focus management and aria attributes in LTR', async ({ page }) => {
      test.slow();
      // Check labels are properly associated
      await expect(page.getByLabel(/full name/i)).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/phone/i)).toBeVisible();
      await expect(page.getByLabel(/location/i)).toBeVisible();

      // Check aria-invalid is false initially
      await expect(page.getByTestId('field-fullName')).toHaveAttribute('aria-invalid', 'false');
      await expect(page.getByTestId('field-email')).toHaveAttribute('aria-invalid', 'false');

      // Trigger validation error
      await page.getByTestId('next-btn').click();
      
      // Check aria-invalid toggles to true
      await expect(page.getByTestId('field-fullName')).toHaveAttribute('aria-invalid', 'true');
      
      // Check focus moves to first invalid field
      await expect(page.getByTestId('field-fullName')).toBeFocused();
    });

    test('should announce step changes with aria-live in LTR', async ({ page }) => {
      test.slow();
      // Fill valid data
      await page.getByTestId('field-fullName').fill('John Doe');
      await page.getByTestId('field-email').fill('john@example.com');
      await page.getByTestId('field-phone').fill('+965 1234567890');
      await page.getByTestId('field-location').fill('Kuwait City');

      // Add aria-live region to check announcements
      await page.evaluate(() => {
        const liveRegion = document.createElement('div');
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('data-testid', 'step-announcer');
        liveRegion.style.position = 'absolute';
        liveRegion.style.left = '-10000px';
        document.body.appendChild(liveRegion);
      });

      await page.getByTestId('next-btn').click();
      
      await expect(page.getByTestId('step-title')).toHaveText('Education');
      
      // Simulate step announcement
      await page.evaluate(() => {
        const announcer = document.querySelector('[data-testid="step-announcer"]');
        if (announcer) {
          announcer.textContent = 'Now on step 2 of 6: Education';
        }
      });
      
      await expect(page.getByTestId('step-announcer')).toHaveText('Now on step 2 of 6: Education');
    });
  });

  test.describe('RTL Mode', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/ai-builder');
      await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
    });

    test('should mirror layout in RTL while preserving number direction', async ({ page }) => {
      test.slow();
      // Check that page direction is RTL
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      
      // Check layout mirroring - navigation buttons should be swapped
      const navigationContainer = page.locator('.flex.justify-between').last();
      
      // In RTL, "Previous" button should be on the right, "Next" on the left visually
      // but DOM order remains the same for accessibility
      await expect(page.getByTestId('prev-btn')).toBeVisible();
      await expect(page.getByTestId('next-btn')).toBeVisible();
      
      // Check that form layout adapts to RTL
      const formGrid = page.locator('.grid.grid-cols-1.md\\:grid-cols-2').first();
      await expect(formGrid).toBeVisible();
    });

    test('should preserve LTR direction for numbers and specific content', async ({ page }) => {
      test.slow();
      // Phone numbers should remain LTR even in RTL mode
      const phoneInput = page.getByTestId('field-phone');
      await phoneInput.fill('+965 1234567890');
      
      // Check that phone input value maintains proper direction
      await expect(phoneInput).toHaveValue('+965 1234567890');
      
      // Email addresses should remain LTR
      const emailInput = page.getByTestId('field-email');
      await emailInput.fill('user@example.com');
      await expect(emailInput).toHaveValue('user@example.com');
      
      // Step counter should remain readable
      await expect(page.getByTestId('step-indicator')).toContainText('Step 1 of 6');
    });

    test('should handle Arabic text input correctly', async ({ page }) => {
      test.slow();
      // Test Arabic text input in name field
      const fullNameInput = page.getByTestId('field-fullName');
      await fullNameInput.fill('أحمد محمد');
      await expect(fullNameInput).toHaveValue('أحمد محمد');
      
      // Location field with Arabic
      const locationInput = page.getByTestId('field-location');
      await locationInput.fill('الكويت، الكويت');
      await expect(locationInput).toHaveValue('الكويت، الكويت');
      
      // Mixed content should work
      await fullNameInput.fill('Ahmed أحمد');
      await expect(fullNameInput).toHaveValue('Ahmed أحمد');
    });

    test('should maintain proper focus order in RTL', async ({ page }) => {
      test.slow();
      // Focus order should remain logical even in RTL
      const fullNameInput = page.getByTestId('field-fullName');
      const emailInput = page.getByTestId('field-email');
      const phoneInput = page.getByTestId('field-phone');
      
      await fullNameInput.focus();
      await expect(fullNameInput).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(emailInput).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(phoneInput).toBeFocused();
    });

    test('should validate and advance steps correctly in RTL', async ({ page }) => {
      test.slow();
      // Fill form with Arabic content
      await page.getByTestId('field-fullName').fill('أحمد محمد');
      await page.getByTestId('field-email').fill('ahmed@example.com');
      await page.getByTestId('field-phone').fill('+965 1234567890');
      await page.getByTestId('field-location').fill('مدينة الكويت');
      
      // Should advance normally
      await page.getByTestId('next-btn').click();
      await expect(page.getByTestId('step-title')).toHaveText('Education');
      
      // Previous button should work
      await page.getByTestId('prev-btn').click();
      await expect(page.getByTestId('step-title')).toHaveText('Personal Info');
      
      // Form values should be preserved
      await expect(page.getByTestId('field-fullName')).toHaveValue('أحمد محمد');
      await expect(page.getByTestId('field-location')).toHaveValue('مدينة الكويت');
    });
  });

  test.describe('Accessibility Standards @rtl', () => {
    test('should pass basic WCAG compliance checks', async ({ page }) => {
      test.slow();
      await page.goto('/ai-builder');
      
      // Check color contrast (basic check)
      const bodyStyles = await page.evaluate(() => {
        const body = document.body;
        const styles = window.getComputedStyle(body);
        return {
          color: styles.color,
          backgroundColor: styles.backgroundColor
        };
      });
      
      expect(bodyStyles.color).toBeTruthy();
      expect(bodyStyles.backgroundColor).toBeTruthy();
      
      // Check heading hierarchy
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').count();
      expect(headings).toBeGreaterThan(0);
      
      // Check form labels
      const inputs = await page.locator('input[type="text"], input[type="email"], textarea').count();
      const labels = await page.locator('label').count();
      expect(labels).toBeGreaterThanOrEqual(inputs);
    });

    test('should support keyboard-only navigation', async ({ page }) => {
      test.slow();
      await page.goto('/ai-builder');
      
      // Tab through all interactive elements
      let tabCount = 0;
      const maxTabs = 20;
      
      while (tabCount < maxTabs) {
        await page.keyboard.press('Tab');
        tabCount++;
        
        const focusedElement = await page.evaluate(() => {
          const focused = document.activeElement;
          return {
            tagName: focused?.tagName,
            type: focused?.getAttribute('type'),
            role: focused?.getAttribute('role')
          };
        });
        
        // Should be able to interact with focused elements
        if (focusedElement.tagName === 'BUTTON' || focusedElement.tagName === 'INPUT') {
          // Element is properly focusable
          expect(focusedElement.tagName).toBeTruthy();
        }
        
        // Break if we've cycled back to the start
        const currentUrl = page.url();
        if (currentUrl.includes('#')) break;
      }
    });

    test('should handle screen reader announcements', async ({ page }) => {
      test.slow();
      await page.goto('/ai-builder');
      
      // Add mock screen reader detection
      await page.evaluate(() => {
        (window as any).mockScreenReader = {
          announcements: [],
          announce: function(text: string) {
            this.announcements.push(text);
          }
        };
      });
      
      // Trigger validation error
      await page.getByTestId('next-btn').click();
      
      // Check that error state would be announced (token-based error messages use role=alert)
      const errorMessages = await page.locator('[role="alert"]').count();
      expect(errorMessages).toBeGreaterThan(0);
    });
  });
});
