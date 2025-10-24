declare module 'pdf-parse' {
  export interface PDFParseResult {
    text: string
    numpages?: number
    info?: any
    metadata?: any
    version?: string
  }
  function pdfParse(data: Buffer | Uint8Array | ArrayBuffer, options?: any): Promise<PDFParseResult>
  export default pdfParse
}
