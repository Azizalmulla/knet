"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Shield, Lock, Mail, BadgeCheck } from 'lucide-react'

export default function AcceptInvitePage({ params }: { params: { org: string } }) {
  const router = useRouter()
  const orgSlug = params.org
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const token = useMemo(() => {
    if (typeof window === 'undefined') return ''
    try { return new URLSearchParams(window.location.search).get('token') || '' } catch { return '' }
  }, [])

  useEffect(() => {
    const verify = async () => {
      if (!token) { 
        setError('Missing invite token. Please check the invitation link.')
        setLoading(false)
        return
      }
      try {
        const res = await fetch(`/api/${orgSlug}/admin/accept-invite?token=${encodeURIComponent(token)}`)
        const data = await res.json()
        if (!res.ok) {
          setError(data?.error || 'Invalid or expired invite. Please request a new invitation.')
          setLoading(false)
        } else {
          setEmail(String(data.email || ''))
          setRole(String(data.role || 'admin'))
          setError('') // Clear any previous errors
          setLoading(false)
        }
      } catch {
        setError('Network error. Please check your connection and try again.')
        setLoading(false)
      }
    }
    verify()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    try {
      setSubmitting(true)
      const res = await fetch(`/api/${orgSlug}/admin/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || 'Failed to accept invite')
        return
      }
      setSuccess('Invitation accepted! Redirecting to admin dashboard...')
      setTimeout(() => router.push(`/${orgSlug}/admin`), 800)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center px-4">
      <Card className="w-full max-w-md bg-slate-800 border-slate-700 shadow-2xl">
        <CardHeader className="space-y-1 pb-4">
          <div className="flex items-center justify-center mb-4">
            <Shield className="h-12 w-12 text-amber-500" />
          </div>
          <CardTitle className="text-2xl text-center text-white">
            Accept Admin Invite
          </CardTitle>
          <CardDescription className="text-center text-slate-400">
            Set your password to access {orgSlug} admin
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center text-slate-400 py-6">Verifying invite…</div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              {error && (
                <Alert className="border-red-800 bg-red-950/50">
                  <AlertDescription className="text-red-400">{error}</AlertDescription>
                </Alert>
              )}
              <div>
                <Label className="text-slate-200 flex items-center gap-2">
                  <Mail className="h-4 w-4" /> Email
                </Label>
                <Input value={email} disabled className="mt-1 bg-slate-700 border-slate-600 text-white" />
              </div>
              <div>
                <Label className="text-slate-200 flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4" /> Role
                </Label>
                <Input value={role} disabled className="mt-1 bg-slate-700 border-slate-600 text-white" />
              </div>
              <div>
                <Label htmlFor="password" className="text-slate-200 flex items-center gap-2">
                  <Lock className="h-4 w-4" /> Password (min 8 chars)
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={submitting}
                  className="mt-1 bg-slate-700 border-slate-600 text-white"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <Label htmlFor="confirm" className="text-slate-200 flex items-center gap-2">
                  <Lock className="h-4 w-4" /> Confirm Password
                </Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  disabled={submitting}
                  className="mt-1 bg-slate-700 border-slate-600 text-white"
                  autoComplete="new-password"
                />
              </div>
              {success && (
                <Alert className="border-emerald-800 bg-emerald-950/50">
                  <AlertDescription className="text-emerald-400">{success}</AlertDescription>
                </Alert>
              )}
              <Button 
                type="submit" 
                className="w-full bg-amber-600 hover:bg-amber-700 text-white" 
                disabled={submitting || !email || !token}
                size="lg"
              >
                {submitting ? 'Setting up…' : !email ? 'Invalid Invitation' : 'Accept Invite'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
