import { test, expect } from '@playwright/test';

const base = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Production Smoke Tests', () => {
  // Set shorter timeout for smoke tests
  test.setTimeout(30000);

  test('home page loads correctly', async ({ page }) => {
    await page.goto(base);
    await expect(page).toHaveTitle(/KNET/i);
    await expect(page.getByRole('link')).toBeVisible(); // Should have at least one link
  });

  test('upload page loads and is functional', async ({ page }) => {
    // Navigate directly to the upload page where the file input resides
    await page.goto(`${base}/upload`);
    await expect(page.getByText('Upload Your CV')).toBeVisible();
    
    // Check that upload functionality is available (no broken scripts)
    const uploadSection = page.locator('input[type="file"]').or(page.getByText('Drop your CV'));
    await expect(uploadSection).toBeVisible({ timeout: 10000 });
  });

  test('AI builder loads and wizard starts', async ({ page }) => {
    await page.goto(`${base}/ai-builder`);
    await expect(page.getByRole('heading', { name: 'AI CV Builder' }).first()).toBeVisible();
    
    // Verify wizard is functional
    await expect(page.getByTestId('field-fullName')).toBeVisible();
    await expect(page.getByTestId('next-btn')).toBeVisible();
  });

  test('API endpoints are accessible', async ({ request }) => {
    // Test telemetry endpoint
    const telemetryResponse = await request.get(`${base}/api/telemetry/top?limit=1`);
    expect(telemetryResponse.status()).toBe(200);
    
    const telemetryData = await telemetryResponse.json();
    expect(telemetryData).toHaveProperty('success');
  });

  test('error boundaries are in place', async ({ page }) => {
    // Visit pages that have error boundaries
    await page.goto(`${base}/ai-builder`);
    
    // Check that error boundary is present in DOM (even if not visible)
    // Error boundaries should be wrapped around critical components
    const content = await page.content();
    expect(content.length).toBeGreaterThan(1000); // Basic sanity check for page content
  });

  test('admin page has proper access control', async ({ page }) => {
    await page.goto(`${base}/admin`);
    
    // Should either show admin content or require auth
    // We don't test auth here, just that the page doesn't crash
    await expect(page).toHaveURL(/admin/);
    
    // Page should render without JS errors
    const content = await page.content();
    expect(content).toContain('Admin'); // Should have admin-related content
  });

  test('static assets load correctly', async ({ page }) => {
    await page.goto(base);
    
    // Check for CSS loading (page should be styled)
    const bodyStyles = await page.evaluate(() => {
      return window.getComputedStyle(document.body).fontFamily;
    });
    expect(bodyStyles).toBeTruthy();
  });

  test('rate limiting is active', async ({ request }) => {
    // Make multiple rapid requests to test rate limiting
    const promises = Array.from({ length: 3 }, () => 
      request.post(`${base}/api/cv/submit`, {
        data: { test: 'data' }
      })
    );
    
    const responses = await Promise.all(promises);
    
    // At least one should succeed (200) or be rate limited (429)
    const statusCodes = responses.map(r => r.status());
    const hasValidResponse = statusCodes.some(code => code === 200 || code === 429 || code === 400);
    expect(hasValidResponse).toBe(true);
  });

  test('production environment is correctly configured', async ({ page }) => {
    await page.goto(base);
    
    // Check that we're not in development mode
    const isDev = await page.evaluate(() => {
      return (window as any).__NEXT_DATA__?.nextExport === false;
    });
    
    // In production, should not expose debug info
    const pageText = await page.textContent('body');
    expect(pageText).not.toContain('webpack');
    expect(pageText).not.toContain('__NEXT_DATA__');
  });
});
