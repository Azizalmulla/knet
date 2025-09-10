import { defineConfig, devices } from '@playwright/test';

// Detect CI
const isCI = !!process.env.CI;
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

// Dynamically select projects based on CI
const localProjects = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
];

const ciProjects = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
  { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
];

function shouldRunLocalServer(urlStr: string) {
  try {
    const url = new URL(urlStr);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return true;
  }
}

/**
 * Playwright configuration
 * Local (CI=false): Chromium only, list reporter, retries 0, workers 50% (or default).
 * CI (CI=true): Full matrix, HTML + JUnit reports, retries 2.
 * Always uses baseURL from env with fallback to localhost.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? undefined : '50%',
  // Global timeouts
  timeout: 30_000,
  expect: { timeout: 8_000 },
  // Reporters & artifact locations
  reporter: isCI
    ? [
        ['list'],
        ['junit', { outputFile: './test-results/junit-playwright.xml' }],
        ['html', { outputFolder: './test-results/playwright-report', open: 'never' }],
      ]
    : 'list',
  outputDir: './test-results',
  // Shared settings for all projects
  use: {
    baseURL: BASE_URL,
    headless: true,
    trace: isCI ? 'retain-on-failure' : 'off',
    screenshot: 'only-on-failure',
  },
  projects: isCI ? ciProjects : localProjects,
  // Only run local dev server when targeting localhost
  webServer: shouldRunLocalServer(BASE_URL)
    ? {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: false,
      }
    : undefined,
});
