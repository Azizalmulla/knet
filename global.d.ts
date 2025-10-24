// Ambient module declarations for optional deps used at runtime via dynamic import
// These silence TypeScript when packages are not installed in all environments.

declare module 'jsonresume-theme-macchiato' {
  const theme: any
  export = theme
  export default theme
}

declare module '@sparticuz/chromium' {
  export const args: string[]
  export const defaultViewport: any
  export const executablePath: Promise<string>
}

declare module 'puppeteer-core' {
  const puppeteer: any
  export = puppeteer
}
