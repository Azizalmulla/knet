import React from 'react'

// Jest-safe shim for @react-pdf/renderer.
// - In tests: provide light React stubs (no ESM import)
// - In Node/runtime: attempt to require the real module (works for API routes)
// - In the browser, the consumer may still pass an override module for live preview

const isTest = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test'
let Real: any = null

function loadRealSync(): any {
  if (Real) return Real
  if (isTest) return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Real = require('@react-pdf/renderer')
  } catch {
    Real = null
  }
  return Real
}

function makeStub(name: string) {
  const Comp: React.FC<any> = ({ children, ...props }) => React.createElement('div', { 'data-pdf': name, ...props }, children)
  return Comp
}

function pick(name: string) {
  const mod = loadRealSync()
  return mod ? mod[name] : null
}

export const Document = (props: any) => {
  const Comp = pick('Document') || makeStub('Document')
  return React.createElement(Comp, props)
}

export const Page = (props: any) => {
  const Comp = pick('Page') || makeStub('Page')
  return React.createElement(Comp, props)
}

export const Text = (props: any) => {
  const Comp = pick('Text') || (({ children }: any) => React.createElement('span', { 'data-pdf': 'Text' }, children))
  return React.createElement(Comp, props)
}

export const View = (props: any) => {
  const Comp = pick('View') || makeStub('View')
  return React.createElement(Comp, props)
}

export const PDFViewer = (props: any) => {
  const Comp = pick('PDFViewer') || makeStub('PDFViewer')
  return React.createElement(Comp, props)
}

export const StyleSheet = pick('StyleSheet') || { create: (s: any) => s }

export const Font: any = pick('Font') || {
  register: () => {},
  _knet_families: {},
}

export const Image = (props: any) => {
  const Comp = pick('Image') || makeStub('Image')
  return React.createElement(Comp, props)
}

export const Svg = (props: any) => {
  const Comp = pick('Svg') || makeStub('Svg')
  return React.createElement(Comp, props)
}

export const Path = (props: any) => {
  const Comp = pick('Path') || makeStub('Path')
  return React.createElement(Comp, props)
}

export const Rect = (props: any) => {
  const Comp = pick('Rect') || makeStub('Rect')
  return React.createElement(Comp, props)
}

export const Circle = (props: any) => {
  const Comp = pick('Circle') || makeStub('Circle')
  return React.createElement(Comp, props)
}

export const Line = (props: any) => {
  const Comp = pick('Line') || makeStub('Line')
  return React.createElement(Comp, props)
}

export function setReactPdfOverride(mod: any) {
  if (mod) Real = mod
}
