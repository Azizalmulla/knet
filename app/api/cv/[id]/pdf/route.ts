import { NextResponse } from 'next/server'
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

export const runtime = 'nodejs'

function cvPrintUrl(id: string, token: string | undefined, req: Request) {
  const fallback = new URL(req.url).origin
  const base = process.env.NEXT_PUBLIC_BASE_URL || fallback
  const url = new URL(`/cv/print?id=${id}`, base)
  if (token) url.searchParams.set('token', token)
  return url.toString()
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { id } = params
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token') ?? undefined

  let browser: puppeteer.Browser | null = null
  try {
    // Configure chromium for Vercel serverless
    chromium.setHeadlessMode = true
    chromium.setGraphicsMode = false
    await chromium.font('https://noto-website-2.storage.googleapis.com/pkgs/NotoSansCJKjp-hinted.zip')
    const executablePath = await chromium.executablePath()
    console.log('CHROMIUM_EXEC_PATH:', executablePath)
    // Ensure shared libraries are resolvable (libnspr4.so, etc.)
    try {
      const libDir = '/var/task/node_modules/@sparticuz/chromium/lib'
      const pkgDir = '/var/task/node_modules/@sparticuz/chromium'
      const currentLd = process.env.LD_LIBRARY_PATH || ''
      const paths = [libDir, pkgDir, currentLd].filter(Boolean)
      process.env.LD_LIBRARY_PATH = paths.join(':')
      if (!process.env.FONTCONFIG_PATH) process.env.FONTCONFIG_PATH = libDir
      console.log('LD_LIBRARY_PATH:', process.env.LD_LIBRARY_PATH)
    } catch {}
    
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
      env: {
        ...process.env,
        LD_LIBRARY_PATH: `${process.env.LD_LIBRARY_PATH ? process.env.LD_LIBRARY_PATH + ':' : ''}/var/task/node_modules/@sparticuz/chromium/lib:/var/task/node_modules/@sparticuz/chromium`,
        FONTCONFIG_PATH: process.env.FONTCONFIG_PATH || '/var/task/node_modules/@sparticuz/chromium/lib',
        HOME: process.env.HOME || '/tmp',
      },
    })

    const page = await browser.newPage()
    const target = cvPrintUrl(id, token, req)

    await page.goto(target, { waitUntil: 'networkidle0', timeout: 60000 })
    await page.emulateMediaType('print')

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '18mm', right: '16mm', bottom: '18mm', left: '16mm' },
    })

    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="CV-${id}.pdf"`,
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to generate PDF', detail: String(err?.message || err) },
      { status: 500 }
    )
  } finally {
    try { await browser?.close() } catch {}
  }
}
