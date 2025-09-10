## Regression Testing

- [ ] Run `npm run check:all` - all tests pass
- [ ] If tests fail, fix app code/mocks (not tests) - preserve existing test behavior
- [ ] Keep Playwright separate from Jest configurations
- [ ] Preserve career-map snapshot unless new JSON provided
- [ ] Post failing specs + minimal diffs for any persistent issues

## Production Hardening Verification

- [ ] Error boundaries catch and display friendly errors (no PII in logs)
- [ ] Rate limiting active: 5 requests per IP per 5 minutes on submit APIs
- [ ] Admin dashboard masks PII by default with working reveal toggles
- [ ] CSV exports respect privacy controls (masked when PII hidden)
- [ ] Telemetry API returns top Field/Area combinations with rate limiting
- [ ] Autosave works with 5s debounce (verify NEXT_PUBLIC_DISABLE_AUTOSAVE=true in E2E)
- [ ] Production smoke tests validate critical application paths
- [ ] All new features have both unit tests (Jest) and E2E tests (Playwright)

## Additional Checks

- [ ] If updating career-map data, attach diff of added/removed/edited rows and rationale
- [ ] For E2E failures, attach link to Playwright HTML report (CI artifact)

## Summary
Describe what changed and why.

## Screenshots / Videos (optional)
If UI changes, add captures.
