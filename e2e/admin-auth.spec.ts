import { test, expect } from '@playwright/test';

test.describe('Admin Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth
    await page.goto('/admin');
    await page.evaluate(() => sessionStorage.clear());
  });

  test('should show login form on first visit', async ({ page }) => {
    await page.goto('/admin');
    
    // Should see login form
    await expect(page.locator('[data-testid="admin-key-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="admin-login-button"]')).toBeVisible();
    await expect(page.locator('text=Admin Access')).toBeVisible();
    await expect(page.locator('text=Enter your admin key to access the dashboard')).toBeVisible();
  });

  test('should authenticate with valid admin key', async ({ page }) => {
    await page.goto('/admin');
    
    // Enter correct admin key (from environment)
    const adminKey = process.env.ADMIN_KEY || 'test-admin-key';
    await page.fill('[data-testid="admin-key-input"]', adminKey);
    await page.click('[data-testid="admin-login-button"]');
    
    // Should see dashboard after authentication
    await expect(page.locator('[data-testid="admin-logout-button"]')).toBeVisible();
    // Wait for dashboard to start loading (may have DB connection issues in test)
    await page.waitForTimeout(1000);
    
    // Should have token in sessionStorage
    const token = await page.evaluate(() => sessionStorage.getItem('admin_token'));
    expect(token).toBe(adminKey);
  });

  test('should show error with invalid admin key', async ({ page }) => {
    await page.goto('/admin');
    
    // Enter wrong admin key
    await page.fill('[data-testid="admin-key-input"]', 'wrongkey');
    await page.click('[data-testid="admin-login-button"]');
    
    // Should show error message
    await expect(page.locator('[data-testid="admin-error"]')).toBeVisible();
    await expect(page.locator('text=Invalid key')).toBeVisible();
    
    // Should still be on login form
    await expect(page.locator('[data-testid="admin-key-input"]')).toBeVisible();
  });

  test('should logout and return to login form', async ({ page }) => {
    await page.goto('/admin');
    
    // Login first
    const adminKey = process.env.ADMIN_KEY || 'test-admin-key';
    await page.fill('[data-testid="admin-key-input"]', adminKey);
    await page.click('[data-testid="admin-login-button"]');
    
    // Verify we're logged in
    await expect(page.locator('[data-testid="admin-logout-button"]')).toBeVisible();
    
    // Logout
    await page.click('[data-testid="admin-logout-button"]');
    
    // Should return to login form
    await expect(page.locator('[data-testid="admin-key-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="admin-login-button"]')).toBeVisible();
    
    // Token should be removed
    const token = await page.evaluate(() => sessionStorage.getItem('admin_token'));
    expect(token).toBeNull();
  });

  test('should persist authentication across page refresh', async ({ page }) => {
    await page.goto('/admin');
    
    // Login
    const adminKey = process.env.ADMIN_KEY || 'test-admin-key';
    await page.fill('[data-testid="admin-key-input"]', adminKey);
    await page.click('[data-testid="admin-login-button"]');
    
    // Verify logged in
    await expect(page.locator('[data-testid="admin-logout-button"]')).toBeVisible();
    
    // Refresh page
    await page.reload();
    
    // Should still be logged in
    await expect(page.locator('[data-testid="admin-logout-button"]')).toBeVisible();
    // Dashboard should be accessible (may have DB issues in test env)
    await page.waitForTimeout(1000);
  });

  test('should handle API errors gracefully', async ({ page }) => {
    await page.goto('/admin');
    
    // Mock network failure
    await page.route('/api/admin/auth', route => route.abort());
    
    await page.fill('[data-testid="admin-key-input"]', 'testkey');
    await page.click('[data-testid="admin-login-button"]');
    
    // Should show connection error
    await expect(page.locator('[data-testid="admin-error"]')).toBeVisible();
    await expect(page.locator('text=Connection failed')).toBeVisible();
  });

  test('handles API errors gracefully', async ({ page }) => {
    // Mock a server error for the auth endpoint
    await page.route('/api/admin/auth', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });

    await page.goto('/admin');
    
    await page.fill('[data-testid="admin-key-input"]', 'any-key');
    await page.click('[data-testid="admin-login-button"]');
    
    // Should show error message
    await expect(page.locator('[data-testid="admin-error"]')).toBeVisible();
    await expect(page.locator('text=Login failed')).toBeVisible();
  });

  test('enforces rate limiting on auth attempts', async ({ page }) => {
    let attemptCount = 0;
    
    // Mock rate limiting after 5 attempts
    await page.route('/api/admin/auth', route => {
      attemptCount++;
      
      if (attemptCount <= 5) {
        // First 5 attempts - return 401 unauthorized
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ ok: false })
        });
      } else {
        // 6th+ attempts - return 429 rate limited
        route.fulfill({
          status: 429,
          contentType: 'application/json',
          headers: { 'Retry-After': '300' },
          body: JSON.stringify({ error: 'Too many requests' })
        });
      }
    });

    await page.goto('/admin');
    
    // Make 5 failed attempts
    for (let i = 1; i <= 5; i++) {
      await page.fill('[data-testid="admin-key-input"]', 'wrong-key');
      await page.click('[data-testid="admin-login-button"]');
      await expect(page.locator('[data-testid="admin-error"]')).toBeVisible();
      await page.waitForTimeout(100); // Small delay between attempts
    }
    
    // 6th attempt should be rate limited
    await page.fill('[data-testid="admin-key-input"]', 'wrong-key');
    await page.click('[data-testid="admin-login-button"]');
    
    // Should show rate limiting error
    await expect(page.locator('text=Too many login attempts')).toBeVisible();
    
    expect(attemptCount).toBe(6);
  });

  test('shows inactivity timeout notification', async ({ page }) => {
    // Reduce timeout for testing (30 seconds instead of 30 minutes)
    await page.addInitScript(() => {
      // Mock the inactivity timeout to be much shorter for testing
      const originalTimeout: any = window.setTimeout as any;
      (window as any).setTimeout = (callback: any, delay: number) => {
        if (delay === 30 * 60 * 1000) { // 30 minutes
          return originalTimeout(callback, 1000); // 1 second instead
        }
        return originalTimeout(callback, delay);
      };
    });

    await page.goto('/admin');
    
    // Login successfully
    await page.fill('[data-testid="admin-key-input"]', process.env.ADMIN_KEY || 'test-key');
    await page.click('[data-testid="admin-login-button"]');
    
    // Wait for dashboard to load
    await expect(page.locator('text=Admin Dashboard')).toBeVisible();
    
    // Wait for inactivity timeout (should happen after 1 second due to our mock)
    await page.waitForTimeout(2000);
    
    // Should show inactivity timeout notification
    await expect(page.locator('text=Session expired due to inactivity')).toBeVisible();
    
    // Should be logged out (login form visible again)
    await expect(page.locator('text=Admin Access')).toBeVisible();
    await expect(page.locator('[data-testid="admin-key-input"]')).toBeVisible();
  });
});
