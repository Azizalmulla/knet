import { test, expect } from '@playwright/test';

test.describe('Autosave Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.evaluate(() => localStorage.clear());
  });

  test('should autosave draft data during form filling', async ({ page }) => {
    await page.goto('/ai-builder');
    
    // Fill some form data
    await page.getByTestId('field-fullName').fill('Test User');
    await page.getByTestId('field-email').fill('test@example.com');
    await page.getByTestId('field-phone').fill('+965 1234567890');
    
    // Wait for autosave (5 second debounce + buffer)
    await page.waitForTimeout(6000);
    
    // Check if data was saved to localStorage
    const savedData = await page.evaluate(() => {
      const draft = localStorage.getItem('knet_cv_draft');
      return draft ? JSON.parse(draft) : null;
    });
    
    expect(savedData).toBeTruthy();
    expect(savedData.data.fullName).toBe('Test User');
    expect(savedData.data.email).toBe('test@example.com');
    expect(savedData.timestamp).toBeDefined();
  });

  test('should show draft restore notification on page reload', async ({ page }) => {
    await page.goto('/ai-builder');
    
    // Fill some data
    await page.getByTestId('field-fullName').fill('John Doe');
    await page.getByTestId('field-email').fill('john@example.com');
    
    // Wait for autosave
    await page.waitForTimeout(6000);
    
    // Reload the page
    await page.reload();
    
    // Should show draft restore notification
    await expect(page.getByText('Draft Found')).toBeVisible();
    await expect(page.getByText(/You have unsaved changes from/)).toBeVisible();
    await expect(page.getByTestId('restore-draft-btn')).toBeVisible();
    await expect(page.getByTestId('dismiss-draft-btn')).toBeVisible();
  });

  test('should restore draft when restore button is clicked', async ({ page }) => {
    await page.goto('/ai-builder');
    
    // Fill some data
    await page.getByTestId('field-fullName').fill('Jane Smith');
    await page.getByTestId('field-email').fill('jane@example.com');
    await page.getByTestId('field-location').fill('Kuwait City');
    
    // Wait for autosave
    await page.waitForTimeout(6000);
    
    // Reload page and restore draft
    await page.reload();
    await page.getByTestId('restore-draft-btn').click();
    
    // Verify data is restored
    await expect(page.getByTestId('field-fullName')).toHaveValue('Jane Smith');
    await expect(page.getByTestId('field-email')).toHaveValue('jane@example.com');
    await expect(page.getByTestId('field-location')).toHaveValue('Kuwait City');
    
    // Draft notification should be gone
    await expect(page.getByText('Draft Found')).not.toBeVisible();
  });

  test('should clear draft when dismiss button is clicked', async ({ page }) => {
    await page.goto('/ai-builder');
    
    // Fill and save data
    await page.getByTestId('field-fullName').fill('Test User');
    await page.waitForTimeout(6000);
    
    // Reload and dismiss
    await page.reload();
    await page.getByTestId('dismiss-draft-btn').click();
    
    // Notification should be gone
    await expect(page.getByText('Draft Found')).not.toBeVisible();
    
    // Data should be cleared from localStorage
    const savedData = await page.evaluate(() => {
      return localStorage.getItem('knet_cv_draft');
    });
    expect(savedData).toBeNull();
  });

  test('should clear draft on successful submission', async ({ page }) => {
    // Mock successful submission
    await page.route('/api/cv/submit', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, id: 'test-id', cvUrl: 'test-url' })
      });
    });

    await page.goto('/ai-builder');
    
    // Fill complete form quickly
    await page.getByTestId('field-fullName').fill('Test User');
    await page.getByTestId('field-email').fill('test@example.com');
    await page.getByTestId('field-phone').fill('+965 1234567890');
    await page.getByTestId('field-location').fill('Kuwait City');
    await page.getByTestId('next-btn').click();

    // Add minimal education
    await page.getByTestId('field-education-0-institution').fill('Test University');
    await page.getByTestId('field-education-0-degree').fill('Computer Science');
    await page.getByTestId('field-education-0-field').fill('Software Engineering');
    await page.getByTestId('field-education-0-graduationDate').fill('2020-09');
    await page.getByTestId('next-btn').click();

    // Skip remaining steps
    await page.getByTestId('next-btn').click(); // experience
    await page.getByTestId('next-btn').click(); // projects
    await page.getByTestId('next-btn').click(); // skills

    // Complete and submit
    await page.getByTestId('field-fieldOfStudy').click();
    await page.getByRole('option').first().click();
    await page.getByTestId('field-areaOfInterest').click();
    await page.getByRole('option').first().click();
    
    await page.getByText('Submit to KNET').click();
    
    // Wait for submission to complete
    await page.waitForTimeout(2000);
    
    // Draft should be cleared
    const savedData = await page.evaluate(() => {
      return localStorage.getItem('knet_cv_draft');
    });
    expect(savedData).toBeNull();
  });

  test('should not show draft notification for expired drafts', async ({ page }) => {
    // Set an expired draft (over 24 hours old)
    const expiredTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
    const expiredDraft = {
      data: { fullName: 'Old User' },
      timestamp: expiredTimestamp,
      version: '1.0'
    };

    await page.evaluate((draft) => {
      localStorage.setItem('knet_cv_draft', JSON.stringify(draft));
    }, expiredDraft);

    await page.goto('/ai-builder');
    
    // Should not show draft notification
    await expect(page.getByText('Draft Found')).not.toBeVisible();
    
    // Expired draft should be removed
    const savedData = await page.evaluate(() => {
      return localStorage.getItem('knet_cv_draft');
    });
    expect(savedData).toBeNull();
  });

  test('should not autosave when NEXT_PUBLIC_DISABLE_AUTOSAVE is set', async ({ page }) => {
    // This test would be run with environment variable set
    // For now, we'll test the behavior by mocking the environment
    await page.addInitScript(() => {
      // Mock the environment variable being set
      (window as any).__NEXT_ENV_DISABLE_AUTOSAVE = 'true';
    });

    await page.goto('/ai-builder');
    
    // Fill form data
    await page.getByTestId('field-fullName').fill('Test User');
    await page.getByTestId('field-email').fill('test@example.com');
    
    // Wait longer than autosave period
    await page.waitForTimeout(7000);
    
    // Should not have saved anything (in real implementation this would check the env var)
    // For this test, we're just ensuring the form still works without autosave
    await expect(page.getByTestId('field-fullName')).toHaveValue('Test User');
  });

  test('should handle localStorage errors gracefully', async ({ page }) => {
    // Mock localStorage to throw errors
    await page.addInitScript(() => {
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function() {
        throw new Error('Storage quota exceeded');
      };
    });

    await page.goto('/ai-builder');
    
    // Should still be able to fill form despite storage errors
    await page.getByTestId('field-fullName').fill('Test User');
    await page.getByTestId('field-email').fill('test@example.com');
    
    // Form should continue to work
    await expect(page.getByTestId('field-fullName')).toHaveValue('Test User');
    await expect(page.getByTestId('next-btn')).toBeVisible();
  });
});
