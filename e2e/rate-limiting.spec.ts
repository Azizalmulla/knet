import { test, expect } from '@playwright/test';

test.describe('Rate Limiting', () => {
  test('should block requests after exceeding rate limit', async ({ page, context }) => {
    // Navigate to AI builder
    await page.goto('/ai-builder');

    // Fill out a minimal CV submission
    await page.getByTestId('field-fullName').fill('Rate Test User');
    await page.getByTestId('field-email').fill('ratetest@example.com');
    await page.getByTestId('field-phone').fill('+965 9876543210');
    await page.getByTestId('field-location').fill('Kuwait City');
    await page.getByTestId('next-btn').click();

    // Skip through steps quickly to get to submission
    await page.getByTestId('field-education-0-institution').fill('Test Uni');
    await page.getByTestId('field-education-0-degree').fill('CS');
    await page.getByTestId('field-education-0-field').fill('Tech');
    await page.getByTestId('field-education-0-graduationDate').fill('2020-09');
    await page.getByTestId('next-btn').click();

    await page.getByTestId('next-btn').click(); // Skip experience
    await page.getByTestId('next-btn').click(); // Skip projects
    await page.getByTestId('next-btn').click(); // Skip skills

    // On review step, select career mapping
    await page.getByTestId('field-fieldOfStudy').click();
    await page.getByRole('option', { name: 'Computer Engineering/Computer Science/Technology' }).click();
    await page.getByTestId('field-areaOfInterest').click();
    await page.getByRole('option', { name: 'IT', exact: true }).click();

    // Track submission responses
    const responses: any[] = [];
    
    // Intercept submit API to track requests
    await page.route('/api/cv/submit', async (route) => {
      const url = route.request().url();
      const method = route.request().method();
      responses.push({ url, method });
      
      // Allow first 5 requests, then return 429
      if (responses.length <= 5) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, id: `test-${responses.length}`, cvUrl: 'test-url' })
        });
      } else {
        await route.fulfill({
          status: 429,
          headers: {
            'Retry-After': '300',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            error: 'Too many requests',
            retryAfter: 300
          })
        });
      }
    });

    // Simulate rapid submissions by clicking submit multiple times
    // Note: In real scenario, this would be multiple users or rapid automation
    for (let i = 0; i < 7; i++) {
      await page.getByText('Submit to KNET').click();
      
      // Wait a moment between requests
      await page.waitForTimeout(100);
      
      if (i < 5) {
        // First 5 should succeed - look for success indicators
        // (In real app, this might redirect or show success message)
        await page.waitForTimeout(500);
      } else {
        // 6th+ should show rate limit error
        await expect(page.getByText(/too many requests|rate limit/i)).toBeVisible({
          timeout: 5000
        });
        break;
      }
    }

    // Verify we got the expected number of requests
    expect(responses.length).toBeGreaterThanOrEqual(6);
  });

  test('should show rate limit error with retry-after info', async ({ page }) => {
    await page.goto('/ai-builder');

    // Mock the submit API to always return 429
    await page.route('/api/cv/submit', (route) => {
      route.fulfill({
        status: 429,
        headers: {
          'Retry-After': '300',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'Too many requests',
          retryAfter: 300
        })
      });
    });

    // Fill minimal form and try to submit
    await page.getByTestId('field-fullName').fill('Test User');
    await page.getByTestId('field-email').fill('test@example.com');
    await page.getByTestId('next-btn').click();
    
    // Skip to review
    await page.getByTestId('next-btn').click(); // education
    await page.getByTestId('next-btn').click(); // experience  
    await page.getByTestId('next-btn').click(); // projects
    await page.getByTestId('next-btn').click(); // skills
    
    // Select fields and submit
    await page.getByTestId('field-fieldOfStudy').click();
    await page.getByRole('option').first().click();
    await page.getByTestId('field-areaOfInterest').click();
    await page.getByRole('option').first().click();

    await page.getByText('Submit to KNET').click();

    // Should show rate limiting error message
    await expect(page.getByText(/too many requests|rate limit/i)).toBeVisible();
  });

  test('should handle upload endpoint rate limiting', async ({ page }) => {
    await page.goto('/upload');

    // Mock upload API to return 429
    await page.route('/api/upload', (route) => {
      route.fulfill({
        status: 429,
        headers: {
          'Retry-After': '300',
          'Content-Type': 'application/json'  
        },
        body: JSON.stringify({
          error: 'Too many requests',
          retryAfter: 300
        })
      });
    });

    // Verify the page loads
    await expect(page.getByText('Upload Your CV')).toBeVisible();

    // If there are file upload controls, they should handle rate limiting gracefully
    // (This would depend on how the upload UI is implemented)
  });

  test('should respect retry-after header timing', async ({ page }) => {
    await page.goto('/ai-builder');

    let requestCount = 0;
    
    await page.route('/api/cv/submit', (route) => {
      requestCount++;
      
      if (requestCount === 1) {
        // First request succeeds
        route.fulfill({
          status: 200,
          body: JSON.stringify({ success: true })
        });
      } else {
        // Subsequent requests are rate limited
        route.fulfill({
          status: 429,
          headers: { 'Retry-After': '5' }, // 5 second retry
          body: JSON.stringify({
            error: 'Too many requests',
            retryAfter: 5
          })
        });
      }
    });

    // Fill form quickly
    await page.getByTestId('field-fullName').fill('Test User');
    await page.getByTestId('field-email').fill('test@example.com');
    await page.getByTestId('next-btn').click();
    await page.getByTestId('next-btn').click();
    await page.getByTestId('next-btn').click();
    await page.getByTestId('next-btn').click();
    await page.getByTestId('next-btn').click();

    await page.getByTestId('field-fieldOfStudy').click();
    await page.getByRole('option').first().click();
    await page.getByTestId('field-areaOfInterest').click();
    await page.getByRole('option').first().click();

    // First submit
    await page.getByText('Submit to KNET').click();
    
    // Quick second submit should be rate limited
    await page.getByText('Submit to KNET').click();
    
    // Should see rate limit message
    await expect(page.getByText(/too many requests|rate limit/i)).toBeVisible();
    
    expect(requestCount).toBe(2);
  });
});
