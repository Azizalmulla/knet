'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, FileText, Download, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { adminFetch } from '@/lib/admin-fetch'
import { generateSampleCSV } from '@/lib/csv-parser'

interface CSVUploadProps {
  orgSlug: string
  onSuccess?: () => void
}

export default function CSVUpload({ orgSlug, onSuccess }: CSVUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        toast.error('Please select a CSV file')
        return
      }
      setFile(selectedFile)
      setResult(null)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file first')
      return
    }

    setUploading(true)
    toast.loading('Uploading CSV...', { id: 'csv-upload' })

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await adminFetch(`/api/${orgSlug}/admin/import/csv`, {
        method: 'POST',
        body: formData
      })

      setResult(response)

      if (response.success) {
        toast.success(
          `Success! ${response.created} created, ${response.updated} updated${response.failed > 0 ? `, ${response.failed} failed` : ''}`,
          { id: 'csv-upload' }
        )
        setFile(null)
        if (onSuccess) onSuccess()
      } else {
        toast.error('Import failed. Check the results below.', { id: 'csv-upload' })
      }
    } catch (error: any) {
      console.error('CSV upload error:', error)
      toast.error(`Upload failed: ${error.message}`, { id: 'csv-upload' })
    } finally {
      setUploading(false)
    }
  }

  const downloadSample = () => {
    const csv = generateSampleCSV()
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sample-candidates.csv'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Sample CSV downloaded')
  }

  return (
    <Card className="rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          CSV Bulk Import
        </CardTitle>
        <CardDescription>
          Upload a CSV file to import multiple candidates at once
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sample CSV Download */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-900">Need a template?</p>
              <p className="text-xs text-blue-700">Download a sample CSV with example data</p>
            </div>
            <Button
              onClick={downloadSample}
              variant="outline"
              size="sm"
              className="border-2 border-blue-500 text-blue-700 hover:bg-blue-100"
            >
              <Download className="w-4 h-4 mr-2" />
              Sample CSV
            </Button>
          </div>
        </div>

        {/* File Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Select CSV File</label>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={uploading}
              className="flex-1 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-2 file:border-black file:text-sm file:font-semibold file:bg-white file:text-black hover:file:bg-gray-100 disabled:opacity-50"
            />
            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="border-2 border-black bg-black text-white hover:bg-gray-800"
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
          {file && (
            <p className="text-xs text-muted-foreground">
              Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        {/* CSV Format Info */}
        <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-3">
          <p className="text-sm font-semibold mb-2">Required Columns:</p>
          <ul className="text-xs space-y-1 text-gray-700">
            <li>• <strong>email</strong> or <strong>full_name</strong> (at least one required)</li>
            <li>• <strong>phone</strong> (optional)</li>
            <li>• <strong>field_of_study</strong> (optional)</li>
            <li>• <strong>area_of_interest</strong> (optional)</li>
            <li>• <strong>gpa</strong> (optional, 0-5 scale)</li>
            <li>• <strong>degree</strong> (optional, e.g., Bachelor's, Master's)</li>
            <li>• <strong>years_of_experience</strong> (optional: 0-1, 2-3, 4-5, or 6+)</li>
          </ul>
          <p className="text-xs text-muted-foreground mt-2">
            Column names are flexible (e.g., "Email", "E-mail", "email address" all work)
          </p>
        </div>

        {/* Upload Results */}
        {result && (
          <div className={`border-2 rounded-lg p-4 ${result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
            <div className="flex items-start gap-3">
              {result.success ? (
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
              )}
              <div className="flex-1 space-y-2">
                <p className="font-semibold text-sm">
                  {result.success ? 'Import Completed!' : 'Import Failed'}
                </p>

                {result.success && (
                  <div className="text-sm space-y-1">
                    <p>✅ <strong>{result.created}</strong> candidates created</p>
                    <p>🔄 <strong>{result.updated}</strong> candidates updated</p>
                    {result.failed > 0 && (
                      <p className="text-red-700">❌ <strong>{result.failed}</strong> failed</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Processed in {result.processingTime}ms
                    </p>
                  </div>
                )}

                {result.warnings && result.warnings.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs font-semibold cursor-pointer flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {result.warnings.length} warnings
                    </summary>
                    <ul className="mt-1 space-y-1 text-xs text-yellow-700 ml-5">
                      {result.warnings.slice(0, 10).map((warning: string, i: number) => (
                        <li key={i}>• {warning}</li>
                      ))}
                      {result.warnings.length > 10 && (
                        <li>... and {result.warnings.length - 10} more</li>
                      )}
                    </ul>
                  </details>
                )}

                {result.failedRows && result.failedRows.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs font-semibold cursor-pointer flex items-center gap-1 text-red-700">
                      <XCircle className="w-4 h-4" />
                      {result.failedRows.length} failed rows
                    </summary>
                    <ul className="mt-1 space-y-1 text-xs text-red-700 ml-5">
                      {result.failedRows.slice(0, 10).map((fail: any, i: number) => (
                        <li key={i}>
                          • Row {fail.row} ({fail.email}): {fail.error}
                        </li>
                      ))}
                      {result.failedRows.length > 10 && (
                        <li>... and {result.failedRows.length - 10} more</li>
                      )}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
