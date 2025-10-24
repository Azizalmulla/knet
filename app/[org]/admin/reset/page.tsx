"use client"

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

function OrgAdminResetContent({ orgSlug }: { orgSlug: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const t = searchParams.get('token') || ''
    setToken(t)
  }, [searchParams])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!token) {
      setError('Invalid or missing token.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/${orgSlug}/admin/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Reset failed')
      } else {
        setDone(true)
        setTimeout(() => router.push(`/${orgSlug}/admin/login`), 1500)
      }
    } catch {
      setError('Reset failed. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset password</CardTitle>
          <CardDescription>Enter a new password for your account</CardDescription>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="text-sm text-muted-foreground">Password updated. Redirecting to login…</div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <Label htmlFor="password">New password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} />
              </div>
              {error && <div className="text-sm text-destructive">{error}</div>}
              <div className="flex gap-2">
                <Button type="submit" disabled={loading} className="flex-1">{loading ? 'Updating…' : 'Update password'}</Button>
                <Button type="button" variant="outline" onClick={() => router.push(`/${orgSlug}/admin/login`)}>Back to login</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function OrgAdminReset({ params }: { params: { org: string } }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center px-4">Loading…</div>}>
      <OrgAdminResetContent orgSlug={params.org} />
    </Suspense>
  )
}
