import '@testing-library/jest-dom'

/** Disable autosave/telemetry in tests */
process.env.NEXT_PUBLIC_DISABLE_AUTOSAVE = '1'
process.env.NEXT_PUBLIC_E2E = '1'

/** Prefer modern user-event (only load in jsdom) */
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  // Lazy-require to avoid importing user-event in Node env tests
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const userEvent = require('@testing-library/user-event')
  globalThis.userEvent = userEvent
}

// Mock fetch globally
global.fetch = jest.fn()

// Mock Response constructor
global.Response = class Response {
  constructor(body, init) {
    this.body = body
    this.status = init?.status || 200
    this.ok = this.status >= 200 && this.status < 300
    this.headers = new Map(Object.entries(init?.headers || {}))
  }
  
  async json() {
    return JSON.parse(this.body)
  }
  
  async text() {
    return this.body
  }

  // Align with Next.js spec extension Response.json
  static json(data, init) {
    const status = init?.status ?? 200
    const incoming = init?.headers || {}
    const headers = { 'Content-Type': 'application/json', ...incoming }
    return new global.Response(JSON.stringify(data), { status, headers })
  }
}

// Suppress act() warnings and other noisy test warnings
const originalError = console.error
jest.spyOn(console, 'error').mockImplementation((...args) => {
  const message = args[0]?.toString?.() || ''
  
  // Suppress common test warnings that don't affect functionality
  if (
    message.includes('Warning: ReactDOM.render is no longer supported') ||
    message.includes('Warning: An update to') ||
    message.includes('act(...)') ||
    message.includes('Warning: useLayoutEffect does nothing on the server') ||
    message.includes('Warning: Failed prop type') ||
    message.includes('Warning: Each child in a list should have a unique "key" prop')
  ) {
    return
  }
  originalError.call(console, ...args)
})

// Mock ResizeObserver (global and window) using class style
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// @ts-ignore
global.ResizeObserver = ResizeObserverMock
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.ResizeObserver = ResizeObserverMock
}

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock window.matchMedia only in browser environment
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })
}

// Polyfill pointer capture APIs used by Radix UI under jsdom
if (typeof window !== 'undefined' && window.HTMLElement) {
  if (!window.HTMLElement.prototype.hasPointerCapture) {
    Object.defineProperty(window.HTMLElement.prototype, 'hasPointerCapture', {
      configurable: true,
      writable: true,
      value: () => false,
    })
  }
  if (!window.HTMLElement.prototype.setPointerCapture) {
    Object.defineProperty(window.HTMLElement.prototype, 'setPointerCapture', {
      configurable: true,
      writable: true,
      value: () => {},
    })
  }
}

// Provide a basic navigator + clipboard for environments that need it
const clip = {
  writeText: jest.fn().mockResolvedValue(undefined),
  readText: jest.fn().mockResolvedValue(''),
}

if (typeof global.navigator === 'undefined' || !global.navigator) {
  Object.defineProperty(global, 'navigator', {
    configurable: true,
    writable: true,
    value: {},
  })
}

if (!('clipboard' in global.navigator)) {
  Object.defineProperty(global.navigator, 'clipboard', {
    configurable: true,
    writable: true,
    value: clip,
  })
}

if (typeof window !== 'undefined' && window.navigator) {
  // Ensure window.navigator.clipboard exists in jsdom
  try {
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      writable: true,
      value: clip,
    })
  } catch {}
}
