// PDF generation using built-in template
// Guaranteed to work in serverless environments

import { renderBuiltInTemplate } from './built-in-template'

export async function renderBuiltInPdf(cv: any): Promise<Uint8Array | null> {
  try {
    // Generate HTML from built-in template
    const html = renderBuiltInTemplate(cv)
    if (!html) return null

    // Lazy import chromium + puppeteer-core
    const chromiumMod = await import('@sparticuz/chromium').catch(() => null as any)
    const puppeteerMod = await import('puppeteer-core').catch(() => null as any)
    const chromium = chromiumMod ? ((chromiumMod as any).default || chromiumMod) : null
    const puppeteer = puppeteerMod ? ((puppeteerMod as any).default || puppeteerMod) : null
    
    if (!chromium || !puppeteer) {
      console.error('[PDF] Chromium or Puppeteer not available')
      return null
    }

    // Get executable path
    let executablePath: string = ''
    try {
      const ep = (chromium as any).executablePath
      executablePath = typeof ep === 'function' ? await ep.call(chromium) : (ep as string)
    } catch (err) {
      console.error('[PDF] Failed to get executable path:', err)
      return null
    }
    
    if (!executablePath || typeof executablePath !== 'string') {
      console.error('[PDF] Invalid executable path')
      return null
    }

    // Launch browser and generate PDF
    const browser = await (puppeteer as any).launch({
      args: ((chromium as any).args || []),
      defaultViewport: (chromium as any).defaultViewport,
      executablePath,
      headless: true,
      ignoreHTTPSErrors: true,
    })

    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    
    try { 
      await page.emulateMediaType('screen') 
    } catch {}
    
    const pdfBuffer: Buffer = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      format: 'A4',
      margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' },
    })
    
    await browser.close()
    return new Uint8Array(pdfBuffer)
  } catch (err) {
    console.error('[PDF] Generation failed:', err)
    return null
  }
}
