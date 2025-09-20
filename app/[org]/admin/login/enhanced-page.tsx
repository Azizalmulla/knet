"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { useLanguage } from '@/lib/language'
import { toast } from 'sonner'
import { Lock, Mail, AlertCircle, Building2, Shield } from 'lucide-react'

export default function OrgAdminLoginPage({ params }: { params: { org: string } }) {
  const router = useRouter()
  const { t } = useLanguage()
  const orgSlug = params.org
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [csrfToken, setCsrfToken] = useState('')
  const [orgInfo, setOrgInfo] = useState<{ name: string; logo?: string } | null>(null)
  
  // Fetch CSRF token and org info on mount
  useEffect(() => {
    fetchCsrfToken()
    fetchOrgInfo()
  }, [orgSlug])
  
  const fetchCsrfToken = async () => {
    try {
      const res = await fetch(`/api/${orgSlug}/admin/csrf`)
      const data = await res.json()
      setCsrfToken(data.token)
    } catch {
      // Fallback to timestamp-based token
      setCsrfToken(Date.now().toString())
    }
  }
  
  const fetchOrgInfo = async () => {
    try {
      const res = await fetch(`/api/organizations/${orgSlug}/info`)
      if (res.ok) {
        const data = await res.json()
        setOrgInfo(data)
      }
    } catch {
      // Org info is optional
    }
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Client-side validation
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address')
      return
    }
    
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    
    setError('')
    setLoading(true)
    
    try {
      const res = await fetch(`/api/${orgSlug}/admin/login`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({ 
          email, 
          password,
          rememberMe 
        })
      })
      
      const data = await res.json()
      
      if (res.ok) {
        toast.success('Login successful')
        
        // Store org in localStorage for quick access
        localStorage.setItem('last_admin_org', orgSlug)
        
        // Redirect to dashboard
        router.push(`/${orgSlug}/admin`)
      } else if (res.status === 429) {
        setError('Too many login attempts. Please try again in a few minutes.')
      } else {
        setError(data.error || 'Invalid credentials')
      }
    } catch (error) {
      setError('Network error. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }
  
  const isRTL = typeof window !== 'undefined' && document.dir === 'rtl'
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1 pb-4">
          <div className="flex items-center justify-center mb-4">
            {orgInfo?.logo ? (
              <img 
                src={orgInfo.logo} 
                alt={orgInfo.name}
                className="h-12 w-auto object-contain"
              />
            ) : (
              <Building2 className="h-12 w-12 text-primary" />
            )}
          </div>
          <CardTitle className="text-2xl text-center">
            {t('admin_login') || 'Admin Login'}
          </CardTitle>
          <CardDescription className="text-center">
            {orgInfo?.name || orgSlug} {t('admin_portal') || 'Admin Portal'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {t('email') || 'Email'}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="mt-1"
                autoComplete="email"
                dir="ltr"
              />
            </div>
            
            <div>
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                {t('password') || 'Password'}
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="mt-1"
                autoComplete="current-password"
                dir="ltr"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="remember" 
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                disabled={loading}
              />
              <Label 
                htmlFor="remember" 
                className="text-sm font-normal cursor-pointer"
              >
                {t('remember_me') || 'Remember me for 30 days'}
              </Label>
            </div>
            
            {error && (
              <Alert className="border-destructive bg-destructive/10">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-destructive">
                  {error}
                </AlertDescription>
              </Alert>
            )}
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
              size="lg"
            >
              {loading ? (t('signing_in') || 'Signing in...') : (t('sign_in') || 'Sign In')}
            </Button>
            
            <div className="text-center text-sm text-muted-foreground">
              <Shield className="h-3 w-3 inline mr-1" />
              {t('secure_connection') || 'Secure connection'}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
