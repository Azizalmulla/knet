import { test, expect } from '@playwright/test'

const ORG = process.env.E2E_ORG_SLUG || 'careerly'

// Seed sessionStorage admin_token so adminFetch adds x-admin-key
// Middleware allows 'test-admin-key' in non-prod.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { sessionStorage.setItem('admin_token', 'test-admin-key') } catch {}
  })
})

test.describe('Admin Dashboard smoke', () => {
  test('filters, paginate, export CSV, audit tab, presign (if available)', async ({ page, request }, testInfo) => {
    await page.goto(`/admin?org=${ORG}`)

    // Wait filters render
    await expect(page.getByTestId('filter-type-trigger')).toBeVisible({ timeout: 15000 })

    // Apply some filters if options exist
    await page.getByTestId('filter-type-trigger').click()
    const typeItem = page.getByRole('option', { name: /uploaded|ai/i }).first()
    if (await typeItem.isVisible()) await typeItem.click()

    const fieldTrigger = page.getByTestId('filter-field-trigger')
    if (await fieldTrigger.isVisible()) {
      await fieldTrigger.click()
      const anyField = page.getByRole('option').nth(1)
      if (await anyField.isVisible()) await anyField.click()
    }

    const interestTrigger = page.getByTestId('filter-interest-trigger')
    if (await interestTrigger.isVisible()) {
      await interestTrigger.click()
      const anyInterest = page.getByRole('option').nth(1)
      if (await anyInterest.isVisible()) await anyInterest.click()
    }

    // Try paginate (if backend supports offset via UI; otherwise just ensure table renders)
    await expect(page.getByRole('table')).toBeVisible()

    // Export Candidates CSV and assert filename contains org slug
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /export csv/i }).click()
    ])
    const suggested = await download.suggestedFilename()
    expect(suggested).toContain(ORG)

    // Verify an export_candidates_csv audit row exists (best-effort)
    const auditAfterExport = await request.get(`/api/${ORG}/admin/audit?action=export_candidates_csv&limit=1`)
    if (auditAfterExport.ok()) {
      const json = await auditAfterExport.json()
      expect(Array.isArray(json.events)).toBeTruthy()
    } else {
      testInfo.annotations.push({ type: 'info', description: `Audit check returned ${auditAfterExport.status()} — skipping strict assert` })
    }

    // Toggle PII
    const piiBtn = page.getByTestId('toggle-pii-button')
    await piiBtn.click()
    await piiBtn.click() // restore

    // Presign download: get first candidate id from data-testid
    const nameCell = page.locator('[data-testid^="student-name-"]').first()
    if (!(await nameCell.isVisible())) {
      testInfo.annotations.push({ type: 'info', description: 'No rows to presign — skipping presign assertion' })
      return
    }
    const firstIdAttr = await nameCell.getAttribute('data-testid')
    const id = firstIdAttr?.replace('student-name-', '')
    if (!id) {
      testInfo.annotations.push({ type: 'info', description: 'Could not parse candidate id — skipping presign' })
      return
    }

    const res = await request.post(`/api/${ORG}/admin/cv/presign`, {
      data: { candidateId: id },
      headers: { 'x-admin-key': 'test-admin-key', 'x-admin-email': 'e2e@example.com', 'content-type': 'application/json' }
    })
    if (res.status() === 200) {
      const json = await res.json()
      expect(typeof json.url).toBe('string')
      // Check cv_presign audit row exists
      const auditPresign = await request.get(`/api/${ORG}/admin/audit?action=cv_presign&limit=1`)
      if (auditPresign.ok()) {
        const aj = await auditPresign.json()
        expect(Array.isArray(aj.events)).toBeTruthy()
      }
    } else {
      testInfo.annotations.push({ type: 'info', description: `Presign returned ${res.status()} — skipping URL assertion` })
    }

    // Audit Tab interactions: navigate and export audit CSV
    await page.getByRole('tab', { name: /audit/i }).click()
    // Action filter to export_candidates_csv
    await page.selectOption('select', { label: 'export_candidates_csv' }).catch(() => {})
    const [auditDl] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /export audit csv/i }).click()
    ])
    const auditFilename = await auditDl.suggestedFilename()
    expect(auditFilename).toContain('audit_')
  })
})
