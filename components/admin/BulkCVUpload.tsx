'use client'

import { useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { 
  Upload, FileText, FolderUp, Archive, CheckCircle, XCircle, 
  AlertCircle, Loader2, Users, Clock, Sparkles
} from 'lucide-react'
import { toast } from 'sonner'
import { adminFetch } from '@/lib/admin-fetch'
import JSZip from 'jszip'

interface BulkCVUploadProps {
  orgSlug: string
  onSuccess?: () => void
}

interface FileResult {
  fileName: string
  status: 'pending' | 'processing' | 'success' | 'duplicate' | 'error'
  message?: string
  candidate?: {
    id: string
    fullName: string
    email: string
  }
}

export default function BulkCVUpload({ orgSlug, onSuccess }: BulkCVUploadProps) {
  const [files, setFiles] = useState<File[]>([])
  const [results, setResults] = useState<FileResult[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stats, setStats] = useState({ total: 0, success: 0, duplicates: 0, errors: 0 })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  // Handle file selection
  const handleFiles = useCallback(async (selectedFiles: FileList | File[]) => {
    const fileArray = Array.from(selectedFiles)
    const validFiles: File[] = []
    const zipFiles: File[] = []

    for (const file of fileArray) {
      if (file.name.toLowerCase().endsWith('.zip')) {
        zipFiles.push(file)
      } else if (
        file.name.toLowerCase().endsWith('.pdf') ||
        file.name.toLowerCase().endsWith('.docx')
      ) {
        validFiles.push(file)
      }
    }

    // Extract ZIP files
    for (const zipFile of zipFiles) {
      try {
        toast.loading(`Extracting ${zipFile.name}...`, { id: 'zip-extract' })
        const zip = new JSZip()
        const contents = await zip.loadAsync(zipFile)
        
        for (const [path, zipEntry] of Object.entries(contents.files)) {
          if (zipEntry.dir) continue
          const name = path.split('/').pop() || path
          if (name.toLowerCase().endsWith('.pdf') || name.toLowerCase().endsWith('.docx')) {
            const blob = await zipEntry.async('blob')
            const extractedFile = new File([blob], name, { 
              type: name.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            })
            validFiles.push(extractedFile)
          }
        }
        toast.success(`Extracted ${zipFile.name}`, { id: 'zip-extract' })
      } catch (err) {
        toast.error(`Failed to extract ${zipFile.name}`, { id: 'zip-extract' })
      }
    }

    if (validFiles.length === 0) {
      toast.error('No valid PDF or DOCX files found')
      return
    }

    setFiles(prev => [...prev, ...validFiles])
    setResults(prev => [
      ...prev,
      ...validFiles.map(f => ({ fileName: f.name, status: 'pending' as const }))
    ])

    toast.success(`Added ${validFiles.length} file(s)`)
  }, [])

  // Drag and drop handlers
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const items = e.dataTransfer.items
    const files: File[] = []
    
    // Handle dropped items
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) files.push(file)
      }
    }
    
    if (files.length > 0) {
      handleFiles(files)
    }
  }, [handleFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  // Process all files
  const processFiles = async () => {
    if (files.length === 0) {
      toast.error('No files to process')
      return
    }

    setIsProcessing(true)
    setProgress(0)
    setStats({ total: files.length, success: 0, duplicates: 0, errors: 0 })

    const batchId = `batch-${Date.now()}`
    const concurrency = 3 // Process 3 files at a time
    let processed = 0
    let successCount = 0
    let duplicateCount = 0
    let errorCount = 0

    // Process in batches
    for (let i = 0; i < files.length; i += concurrency) {
      const batch = files.slice(i, i + concurrency)
      
      await Promise.all(batch.map(async (file, batchIndex) => {
        const fileIndex = i + batchIndex
        const fileName = file.name

        // Update status to processing
        setResults(prev => prev.map((r, idx) => 
          idx === fileIndex ? { ...r, status: 'processing' } : r
        ))

        try {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('batchId', batchId)
          formData.append('fileIndex', String(fileIndex))

          const response = await adminFetch(`/api/${orgSlug}/admin/import/bulk-cv`, {
            method: 'POST',
            body: formData
          })

          if (response.duplicate) {
            setResults(prev => prev.map((r, idx) => 
              idx === fileIndex ? { 
                ...r, 
                status: 'duplicate',
                message: response.message
              } : r
            ))
            duplicateCount++
          } else if (response.success) {
            setResults(prev => prev.map((r, idx) => 
              idx === fileIndex ? { 
                ...r, 
                status: 'success',
                candidate: response.candidate
              } : r
            ))
            successCount++
          } else {
            throw new Error(response.message || response.error || 'Unknown error')
          }

        } catch (error: any) {
          console.error(`Failed to process ${fileName}:`, error)
          setResults(prev => prev.map((r, idx) => 
            idx === fileIndex ? { 
              ...r, 
              status: 'error',
              message: error.message || 'Processing failed'
            } : r
          ))
          errorCount++
        }

        processed++
        setProgress(Math.round((processed / files.length) * 100))
        setStats({ 
          total: files.length, 
          success: successCount, 
          duplicates: duplicateCount, 
          errors: errorCount 
        })
      }))
    }

    setIsProcessing(false)

    if (successCount > 0) {
      toast.success(`Imported ${successCount} candidate(s)!`)
      if (onSuccess) onSuccess()
    }

    if (errorCount > 0) {
      toast.error(`${errorCount} file(s) failed to import`)
    }
  }

  // Clear all
  const clearAll = () => {
    setFiles([])
    setResults([])
    setProgress(0)
    setStats({ total: 0, success: 0, duplicates: 0, errors: 0 })
  }

  return (
    <Card className="rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111]">
      <CardHeader className="bg-[#FFEACC] border-b-[3px] border-black rounded-t-2xl">
        <CardTitle className="flex items-center gap-2 text-xl font-black">
          <Users className="w-5 h-5" />
          Bulk CV Import
        </CardTitle>
        <CardDescription className="font-medium text-gray-700">
          Upload multiple CVs at once - PDFs, DOCX, or ZIP archives
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        
        {/* Drop Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="border-[3px] border-dashed border-black rounded-xl p-8 text-center hover:bg-[#FFEACC]/30 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="flex gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#bde0fe] border-[3px] border-black flex items-center justify-center shadow-[3px_3px_0_#111]">
                <FileText className="w-6 h-6" />
              </div>
              <div className="w-12 h-12 rounded-xl bg-[#a7f3d0] border-[3px] border-black flex items-center justify-center shadow-[3px_3px_0_#111]">
                <Archive className="w-6 h-6" />
              </div>
              <div className="w-12 h-12 rounded-xl bg-[#fde68a] border-[3px] border-black flex items-center justify-center shadow-[3px_3px_0_#111]">
                <FolderUp className="w-6 h-6" />
              </div>
            </div>
            <div>
              <p className="font-bold text-lg">Drag & drop files here</p>
              <p className="text-sm text-gray-600">or click to browse</p>
            </div>
            <div className="flex gap-2 text-xs text-gray-500">
              <span className="px-2 py-1 bg-gray-100 rounded-full">PDF</span>
              <span className="px-2 py-1 bg-gray-100 rounded-full">DOCX</span>
              <span className="px-2 py-1 bg-gray-100 rounded-full">ZIP</span>
            </div>
          </div>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.zip"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          // @ts-ignore - webkitdirectory is valid but not in types
          webkitdirectory=""
          accept=".pdf,.docx"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
        />

        {/* Quick Actions */}
        <div className="flex gap-3">
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="flex-1 rounded-xl border-[3px] border-black font-bold shadow-[3px_3px_0_#111] hover:shadow-[1px_1px_0_#111] hover:-translate-y-0.5 transition-all"
          >
            <FileText className="w-4 h-4 mr-2" />
            Select Files
          </Button>
          <Button
            onClick={() => folderInputRef.current?.click()}
            variant="outline"
            className="flex-1 rounded-xl border-[3px] border-black font-bold shadow-[3px_3px_0_#111] hover:shadow-[1px_1px_0_#111] hover:-translate-y-0.5 transition-all"
          >
            <FolderUp className="w-4 h-4 mr-2" />
            Select Folder
          </Button>
        </div>

        {/* File Queue */}
        {files.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-bold">
                {files.length} file(s) queued
              </p>
              {!isProcessing && (
                <Button
                  onClick={clearAll}
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-red-500"
                >
                  Clear all
                </Button>
              )}
            </div>

            {/* Progress Bar */}
            {isProcessing && (
              <div className="space-y-2">
                <Progress value={progress} className="h-3 border-[2px] border-black" />
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-1">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </span>
                  <span>{progress}%</span>
                </div>
              </div>
            )}

            {/* Stats */}
            {(isProcessing || stats.success > 0 || stats.errors > 0) && (
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center p-2 rounded-lg bg-gray-100 border-2 border-gray-200">
                  <p className="text-lg font-black">{stats.total}</p>
                  <p className="text-xs text-gray-600">Total</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-green-100 border-2 border-green-200">
                  <p className="text-lg font-black text-green-700">{stats.success}</p>
                  <p className="text-xs text-green-600">Imported</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-yellow-100 border-2 border-yellow-200">
                  <p className="text-lg font-black text-yellow-700">{stats.duplicates}</p>
                  <p className="text-xs text-yellow-600">Duplicates</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-red-100 border-2 border-red-200">
                  <p className="text-lg font-black text-red-700">{stats.errors}</p>
                  <p className="text-xs text-red-600">Failed</p>
                </div>
              </div>
            )}

            {/* File List */}
            <div className="max-h-60 overflow-y-auto space-y-2 border-2 border-gray-200 rounded-lg p-2">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-2 rounded-lg text-sm ${
                    result.status === 'success' ? 'bg-green-50' :
                    result.status === 'duplicate' ? 'bg-yellow-50' :
                    result.status === 'error' ? 'bg-red-50' :
                    result.status === 'processing' ? 'bg-blue-50' :
                    'bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {result.status === 'pending' && <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                    {result.status === 'processing' && <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />}
                    {result.status === 'success' && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
                    {result.status === 'duplicate' && <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0" />}
                    {result.status === 'error' && <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                    <span className="truncate">{result.fileName}</span>
                  </div>
                  {result.candidate && (
                    <span className="text-xs text-green-600 truncate ml-2">
                      {result.candidate.fullName}
                    </span>
                  )}
                  {result.message && result.status !== 'success' && (
                    <span className="text-xs text-gray-500 truncate ml-2">
                      {result.message}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Process Button */}
            <Button
              onClick={processFiles}
              disabled={isProcessing || files.length === 0}
              className="w-full rounded-xl border-[3px] border-black bg-[#a7f3d0] hover:bg-[#86efac] text-black font-bold py-6 shadow-[4px_4px_0_#111] hover:shadow-[2px_2px_0_#111] hover:-translate-y-0.5 transition-all"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Processing {stats.success + stats.duplicates + stats.errors} of {stats.total}...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Import {files.length} CV(s) with AI Parsing
                </>
              )}
            </Button>
          </div>
        )}

        {/* Features */}
        {files.length === 0 && (
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div className="p-3 rounded-xl bg-[#eeeee4] border-2 border-black">
              <Sparkles className="w-5 h-5 mx-auto mb-1" />
              <p className="font-bold">AI Parsing</p>
              <p className="text-xs text-gray-600">GPT-4o Vision</p>
            </div>
            <div className="p-3 rounded-xl bg-[#eeeee4] border-2 border-black">
              <Users className="w-5 h-5 mx-auto mb-1" />
              <p className="font-bold">Bulk Import</p>
              <p className="text-xs text-gray-600">100s at once</p>
            </div>
            <div className="p-3 rounded-xl bg-[#eeeee4] border-2 border-black">
              <CheckCircle className="w-5 h-5 mx-auto mb-1" />
              <p className="font-bold">Deduplication</p>
              <p className="text-xs text-gray-600">Auto-detect</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
