import { mapToJsonResume } from './mapper'
import { createRequire } from 'module'

const requireCjs = (() => {
  try { return createRequire(import.meta.url) } catch { return null }
})()

async function loadTheme(themeName: string = 'macchiato'): Promise<any | null> {
  // Use explicit, statically analyzable imports so Vercel bundles the themes
  try {
    if (themeName === 'macchiato') {
      const mod: any = await import('jsonresume-theme-macchiato')
      return mod?.default ?? mod
    }
    if (themeName === 'elegant') {
      const mod: any = await import('jsonresume-theme-elegant')
      return mod?.default ?? mod
    }
  } catch {}
  // Best-effort fallback for local dev environments that still have node_modules
  try {
    const req = requireCjs || require
    if (themeName === 'macchiato') return req('jsonresume-theme-macchiato')
    if (themeName === 'elegant') return req('jsonresume-theme-elegant')
  } catch {}
  return null
}

export async function renderMacchiatoHTML(cv: any = {}, themeName: string = 'macchiato'): Promise<string | null> {
  try {
    const theme = await loadTheme(themeName)
    if (!theme) return null
    const resume = mapToJsonResume(cv)
    const html: string = (typeof theme === 'function')
      ? theme(resume)
      : (typeof theme.render === 'function')
        ? theme.render(resume)
        : ''
    if (!html || typeof html !== 'string' || !html.trim()) return null
    return html
  } catch {
    return null
  }
}

export async function renderMacchiatoHTMLWithDebug(cv: any = {}, themeName: string = 'macchiato'): Promise<{ html: string | null; reason?: string; themeShape?: string }> {
  let theme: any = null
  try {
    theme = await loadTheme(themeName)
  } catch (e: any) {
    return { html: null, reason: `import-failed: ${String(e?.message || e)}` }
  }
  if (!theme) return { html: null, reason: 'import-missing' }
  const shape = typeof theme === 'function' ? 'function' : (typeof theme?.render === 'function' ? 'object:render' : typeof theme)
  try {
    const resume = mapToJsonResume(cv)
    const html: string = (typeof theme === 'function') ? theme(resume) : (typeof theme.render === 'function') ? theme.render(resume) : ''
    if (!html || typeof html !== 'string' || !html.trim()) return { html: null, reason: 'empty-html', themeShape: shape }
    return { html, themeShape: shape }
  } catch (e: any) {
    return { html: null, reason: `render-error: ${String(e?.message || e)}`, themeShape: shape }
  }
}

export async function renderMacchiatoPdf(cv: any = {}, themeName: string = 'macchiato'): Promise<Uint8Array | null> {
  try {
    const html = await renderMacchiatoHTML(cv, themeName)
    if (!html) return null

    // Lazy import chromium + puppeteer-core; handle ESM default exports
    const chromiumMod = await import('@sparticuz/chromium').catch(() => null as any)
    const puppeteerMod = await import('puppeteer-core').catch(() => null as any)
    const chromium = chromiumMod ? ((chromiumMod as any).default || chromiumMod) : null
    const puppeteer = puppeteerMod ? ((puppeteerMod as any).default || puppeteerMod) : null
    if (!chromium || !puppeteer) return null

    let executablePath: string = ''
    try {
      const ep = (chromium as any).executablePath
      executablePath = typeof ep === 'function' ? await ep.call(chromium) : (ep as string)
    } catch {}
    if (!executablePath || typeof executablePath !== 'string') return null

    const browser = await (puppeteer as any).launch({
      args: ((chromium as any).args || []),
      defaultViewport: (chromium as any).defaultViewport,
      executablePath,
      headless: true,
      ignoreHTTPSErrors: true,
    })

    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    try { await page.emulateMediaType('screen') } catch {}
    const pdfBuffer: Buffer = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    })
    await browser.close()
    return new Uint8Array(pdfBuffer)
  } catch {
    return null
  }
}

export async function renderMacchiatoPdfWithDebug(cv: any = {}, themeName: string = 'macchiato'): Promise<{ bytes: Uint8Array | null; reason?: string }> {
  // Step 1: HTML render
  try {
    const { html, reason: htmlReason } = await renderMacchiatoHTMLWithDebug(cv, themeName)
    if (!html) return { bytes: null, reason: `html-failed:${htmlReason || 'unknown'}` }

    // Step 2: deps
    let chromium: any = null
    let puppeteer: any = null
    try { const m = await import('@sparticuz/chromium'); chromium = (m as any).default || m } catch (e: any) { return { bytes: null, reason: `import-chromium-failed:${String(e?.message||e)}` } }
    try { const m = await import('puppeteer-core'); puppeteer = (m as any).default || m } catch (e: any) { return { bytes: null, reason: `import-puppeteer-failed:${String(e?.message||e)}` } }

    // Step 3: path
    let executablePath = ''
    try {
      const ep = (chromium as any).executablePath
      executablePath = typeof ep === 'function' ? await ep.call(chromium) : (ep as string)
    } catch (e: any) {
      return { bytes: null, reason: `executable-error:${String(e?.message||e)}` }
    }
    if (!executablePath || typeof executablePath !== 'string' || executablePath.length === 0) {
      return { bytes: null, reason: 'executable-missing' }
    }

    // Step 4: launch + pdf
    try {
      const browser = await (puppeteer as any).launch({
        args: (chromium as any).args || [],
        defaultViewport: (chromium as any).defaultViewport,
        executablePath,
        headless: true,
        ignoreHTTPSErrors: true,
      })
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: 'networkidle0' })
      try { await page.emulateMediaType('screen') } catch {}
      const pdfBuffer: Buffer = await page.pdf({ printBackground: true, preferCSSPageSize: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } })
      await browser.close()
      return { bytes: new Uint8Array(pdfBuffer) }
    } catch (e: any) {
      return { bytes: null, reason: `pdf-error:${String(e?.message||e)}` }
    }
  } catch (e: any) {
    return { bytes: null, reason: `unexpected:${String(e?.message||e)}` }
  }
}
