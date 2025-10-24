'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Copy, Mail, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { adminFetch } from '@/lib/admin-fetch'
import CSVUpload from './CSVUpload'

interface ImportActivity {
  id: string
  source: string
  source_email: string | null
  candidate_count: number
  success_count: number
  failed_count: number
  created_at: string
}

interface ImportStats {
  email_imports: number
  csv_imports: number
  pdf_imports: number
  total_imported: number
  total_failed: number
}

export default function ImportTab({ orgSlug }: { orgSlug: string }) {
  const [activity, setActivity] = useState<ImportActivity[]>([])
  const [stats, setStats] = useState<ImportStats>({
    email_imports: 0,
    csv_imports: 0,
    pdf_imports: 0,
    total_imported: 0,
    total_failed: 0
  })
  const [loading, setLoading] = useState(true)

  const importEmail = `${orgSlug}@import.wathefni.ai`

  useEffect(() => {
    fetchActivity()
  }, [orgSlug])

  const fetchActivity = async () => {
    try {
      const data = await adminFetch(`/api/${orgSlug}/admin/import/activity`)
      setActivity(data.activity || [])
      setStats(data.stats || stats)
    } catch (error) {
      console.error('Failed to fetch import activity:', error)
    } finally {
      setLoading(false)
    }
  }

  const copyEmail = () => {
    navigator.clipboard.writeText(importEmail)
    toast.success('Email address copied!')
  }

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'email_import':
        return <Badge variant="default" className="bg-blue-500"><Mail className="w-3 h-3 mr-1" /> Email</Badge>
      case 'csv_import':
        return <Badge variant="secondary">CSV</Badge>
      case 'pdf_bulk_import':
        return <Badge variant="outline">PDF Bulk</Badge>
      default:
        return <Badge>{source}</Badge>
    }
  }

  const getStatusIcon = (success: number, failed: number) => {
    if (failed > 0) return <XCircle className="w-4 h-4 text-red-500" />
    if (success > 0) return <CheckCircle className="w-4 h-4 text-green-500" />
    return <Clock className="w-4 h-4 text-gray-400" />
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111]">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.email_imports || 0}</div>
            <p className="text-xs text-muted-foreground">Email Imports (30d)</p>
          </CardContent>
        </Card>
        
        <Card className="rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111]">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total_imported || 0}</div>
            <p className="text-xs text-muted-foreground">Total Imported</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111]">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.csv_imports || 0}</div>
            <p className="text-xs text-muted-foreground">CSV Imports</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111]">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{stats.total_failed || 0}</div>
            <p className="text-xs text-muted-foreground">Failed Imports</p>
          </CardContent>
        </Card>
      </div>

      {/* CSV Bulk Upload */}
      <CSVUpload orgSlug={orgSlug} onSuccess={fetchActivity} />

      {/* Email Auto-Import Setup */}
      <Card className="rounded-2xl border-[3px] border-black bg-gradient-to-br from-blue-50 to-white shadow-[6px_6px_0_#111]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            📧 Email Auto-Import
          </CardTitle>
          <CardDescription>
            Automatically import CVs from email applications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Forward job application emails to this address:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white border-2 border-black rounded-lg px-4 py-3 font-mono text-sm">
                {importEmail}
              </code>
              <Button 
                onClick={copyEmail}
                variant="outline"
                size="sm"
                className="border-2 border-black hover:bg-black hover:text-white transition-colors"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </Button>
            </div>
          </div>

          <div className="bg-white border-2 border-black rounded-lg p-4">
            <h4 className="font-semibold mb-2">📝 Setup Instructions:</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Open your company email (Gmail, Outlook, etc.)</li>
              <li>Go to Settings → Forwarding and create a new rule</li>
              <li>
                Add filter: <strong>When email has attachment + subject contains "application"</strong>
              </li>
              <li>
                Action: <strong>Forward to {importEmail}</strong>
              </li>
              <li>Save and you're done! New CVs will auto-import.</li>
            </ol>
          </div>

          <div className="flex items-start gap-2 bg-green-50 border-2 border-green-200 rounded-lg p-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-green-900">What happens automatically:</p>
              <ul className="mt-1 space-y-1 text-green-800">
                <li>✓ CV attachment is extracted and stored</li>
                <li>✓ Candidate info is parsed from email body</li>
                <li>✓ CV is automatically parsed with AI</li>
                <li>✓ Candidate gets confirmation email</li>
                <li>✓ You get notification in dashboard</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Recent Import Activity
          </CardTitle>
          <CardDescription>
            Last 50 import operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : activity.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No imports yet</p>
              <p className="text-xs mt-1">Set up email forwarding to start auto-importing CVs</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activity.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 border-2 border-gray-200 rounded-lg hover:border-black transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(item.success_count, item.failed_count)}
                    <div>
                      <div className="flex items-center gap-2">
                        {getSourceBadge(item.source)}
                        {item.source_email && (
                          <span className="text-xs text-muted-foreground">
                            from {item.source_email}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(item.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {item.success_count} imported
                    </p>
                    {item.failed_count > 0 && (
                      <p className="text-xs text-red-600">
                        {item.failed_count} failed
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
