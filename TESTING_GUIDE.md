# Testing Guide

## Test Infrastructure Overview

This project uses a robust testing setup with clear separation between unit tests (Jest) and end-to-end tests (Playwright).

## Available Scripts

```bash
# Unit tests with Jest
npm test                 # Run all unit tests
npm run test:watch       # Run tests in watch mode

# E2E tests with Playwright  
npm run e2e              # Run E2E tests headless
npm run e2e:headed       # Run E2E tests with browser UI

# Full test suite
npm run check:all        # Run both unit and E2E tests

# Production smoke tests
BASE_URL=https://your-domain.vercel.app npm run e2e -- e2e/smoke.spec.ts
```

## Test Structure

- `__tests__/` - Unit and integration tests (Jest + React Testing Library)
- `e2e/` - End-to-end tests (Playwright)
- `e2e/smoke.spec.ts` - Minimal production smoke tests

## Data Integrity

The career map data is protected by snapshot tests. Any changes to the career map structure will fail CI until explicitly approved.

## Error Monitoring

The application includes error budget monitoring that alerts when:
- Upload errors exceed 10 per 5-minute window
- AI API retries exceed 15 per 5-minute window

## Regression Testing Prompt

Use this prompt when making changes to forms, schemas, or core functionality:

---

**AI Assistant Regression Testing Protocol:**

Run `npm run check:all`. If any test fails, fix it. Do not modify Playwright tests to pass; adjust the app code or mocks. Ensure career-map snapshot remains unchanged unless I explicitly provide a new JSON; if snapshot changes, show me a diff summary of added/removed/edited rows.

Key principles:
1. Tests should reflect intended behavior, not accommodate broken code  
2. Career map data is sacred - changes require explicit approval
3. Both Jest and Playwright tests must pass before deployment
4. Error budget alerts should be investigated, not silenced

---

## CI/CD Pipeline

GitHub Actions automatically runs:
1. Unit tests on every push/PR
2. E2E tests on every push/PR  
3. Tests run in parallel for faster feedback

## Troubleshooting

### Common Issues

**Jest picks up Playwright files:**
- Check `jest.config.js` testPathIgnorePatterns includes `/e2e/`
- Verify testMatch patterns exclude e2e directory

**E2E tests fail:**
- Ensure development server is running for local tests
- Check BASE_URL environment variable for production tests
- Verify Playwright browsers are installed: `npx playwright install`

**Snapshot tests fail:**
- Review changes with `npm test -- --updateSnapshot` (use carefully)
- Career map snapshots should only be updated with explicit approval

### Test Debugging

```bash
# Debug specific test
npm test -- --testNamePattern="specific test name"

# Run tests with coverage
npm test -- --coverage

# Debug E2E with browser open  
npm run e2e:headed
```
