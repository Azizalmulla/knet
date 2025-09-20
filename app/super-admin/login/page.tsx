"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { Shield, Lock, Mail, AlertCircle } from 'lucide-react'

export default function SuperAdminLogin() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      const res = await fetch('/api/super-admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      
      const data = await res.json()
      
      if (res.ok) {
        toast.success('Welcome, Super Admin!')
        // Use replace to avoid going back to login on history
        router.replace('/super-admin')
        // Fallback: force a hard navigation to ensure cookie is read
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.location.assign('/super-admin')
          }
        }, 150)
      } else if (res.status === 429) {
        setError('Too many attempts. Please try again later.')
      } else {
        setError(data.error || 'Invalid credentials')
      }
    } catch (error) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
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
            Super Admin Portal
          </CardTitle>
          <CardDescription className="text-center text-slate-400">
            Platform administration access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-slate-200 flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="super@careerly.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="mt-1 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                autoComplete="email"
              />
            </div>
            
            <div>
              <Label htmlFor="password" className="text-slate-200 flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="mt-1 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                autoComplete="current-password"
              />
            </div>
            
            {error && (
              <Alert className="border-red-800 bg-red-950/50">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <AlertDescription className="text-red-400">
                  {error}
                </AlertDescription>
              </Alert>
            )}
            
            <Button 
              type="submit" 
              className="w-full bg-amber-600 hover:bg-amber-700 text-white" 
              disabled={loading}
              size="lg"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </Button>
            
            <div className="text-center text-sm text-slate-400">
              <Shield className="h-3 w-3 inline mr-1" />
              Platform Owner Access Only
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
