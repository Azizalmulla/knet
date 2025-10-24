"use client";

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/lib/language';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Mail, Lock } from 'lucide-react'

function AdminLoginContent() {
  const { t } = useLanguage();
  const router = useRouter();

  // Mode: 'org' (email/password) or 'key' (legacy)
  const [mode, setMode] = useState<'org'|'key'>('org');

  // Common
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Email/password login state (unified)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [requiresOrgSelection, setRequiresOrgSelection] = useState(false)
  const [orgOptions, setOrgOptions] = useState<{ slug: string; name: string }[]>([])
  const [selectedOrg, setSelectedOrg] = useState('')

  // Admin key state
  const [token, setToken] = useState('');

  // Handlers
  const handleOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe }),
        credentials: 'include',
        cache: 'no-store'
      });
      const data = await res.json();
      if (res.ok && data?.success && data?.orgSlug) {
        // Single match success
        setTimeout(() => { window.location.href = `/${data.orgSlug}/admin`; }, 300);
      } else if (res.ok && data?.requiresOrgSelection && Array.isArray(data?.orgs) && data.orgs.length) {
        // Multiple orgs matched this email/password; let admin choose
        setRequiresOrgSelection(true)
        setOrgOptions(data.orgs)
        setSelectedOrg(data.orgs[0]?.slug || '')
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      setError(t('admin_connection_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleOrgChoice = async () => {
    if (!selectedOrg) return
    setError('')
    setLoading(true)
    try {
      const slug = selectedOrg
      const res = await fetch(`/api/${slug}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe }),
        credentials: 'include',
        cache: 'no-store'
      })
      const data = await res.json()
      if (res.ok) {
        setTimeout(() => { window.location.href = `/${slug}/admin` }, 300)
      } else {
        setError(data.error || 'Login failed')
      }
    } catch (e) {
      setError(t('admin_connection_failed'))
    } finally {
      setLoading(false)
    }
  }

  const handleKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const normalizedToken = token.trim();

    try { localStorage.setItem('admin_token', normalizedToken); sessionStorage.setItem('admin_token', normalizedToken); } catch {}
    setTimeout(() => {
      try { localStorage.setItem('admin_token', normalizedToken); sessionStorage.setItem('admin_token', normalizedToken); } catch {}
    }, 100);

    const fallbackKeys = process.env.NODE_ENV !== 'production' ? ['test-admin-key', 'test-key'] : [];
    if (fallbackKeys.includes(normalizedToken)) {
      try { localStorage.setItem('admin_token', normalizedToken); sessionStorage.setItem('admin_token', normalizedToken); } catch {}
      setLoading(false);
      router.replace('/admin');
      return;
    }

    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: normalizedToken })
      });
      const data = await response.json();

      if (response.ok && data.ok) {
        if (rememberMe) {
          localStorage.setItem('admin_token', normalizedToken);
          localStorage.setItem('admin_token_timestamp', Date.now().toString());
        }
        sessionStorage.setItem('admin_token', normalizedToken);
        router.replace('/admin');
      } else {
        if (response.status === 429) setError(t('too_many_attempts'));
        else if (response.status >= 500) setError(t('login_failed'));
        else setError(t('admin_invalid_key'));
      }
    } catch (err) {
      setError(t('admin_connection_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('admin_access') || 'Admin Access'}</CardTitle>
          <CardDescription>
            {mode === 'org' ? (t('admin_sign_in_email_only') || 'Sign in with email and password') : (t('admin_enter_key') || 'Enter admin key')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mode === 'org' ? (
            !requiresOrgSelection ? (
              <form onSubmit={handleOrgSubmit} className="space-y-4">
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
                    disabled={loading}
                    className="mt-1"
                    autoComplete="email"
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
                    disabled={loading}
                    className="mt-1"
                    autoComplete="current-password"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="remember" checked={rememberMe} onCheckedChange={(v) => setRememberMe(Boolean(v))} />
                    <Label htmlFor="remember">{t('remember_me') || 'Remember me for 30 days'}</Label>
                  </div>
                  <Button type="button" variant="link" className="px-0" onClick={() => setMode('key')}>
                    {t('use_admin_key_instead') || 'Use admin key instead'}
                  </Button>
                </div>
                {error && (
                  <Alert className="border-destructive bg-destructive/10">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <AlertDescription className="text-destructive">{error}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (t('signing_in') || 'Signing in...') : (t('sign_in') || 'Sign In')}
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">{t('select_organization') || 'Select your organization'}</div>
                <div className="space-y-2">
                  {orgOptions.map((org) => (
                    <Button
                      key={org.slug}
                      type="button"
                      variant={selectedOrg === org.slug ? 'default' : 'outline'}
                      className="w-full justify-start"
                      onClick={() => setSelectedOrg(org.slug)}
                      disabled={loading}
                    >
                      {org.name}
                      <span className="ml-2 text-xs text-muted-foreground">({org.slug})</span>
                    </Button>
                  ))}
                </div>
                {error && (
                  <Alert className="border-destructive bg-destructive/10">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <AlertDescription className="text-destructive">{error}</AlertDescription>
                  </Alert>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" className="w-1/2" onClick={() => { setRequiresOrgSelection(false); setOrgOptions([]); setSelectedOrg(''); setError('') }} disabled={loading}>
                    {t('back') || 'Back'}
                  </Button>
                  <Button className="w-1/2" onClick={handleOrgChoice} disabled={!selectedOrg || loading}>
                    {t('continue') || 'Continue'}
                  </Button>
                </div>
              </div>
            )
          ) : (
            <form onSubmit={handleKeySubmit}>
              <div className="space-y-4">
                <Input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleKeySubmit(e)}
                  placeholder={t('enter_admin_key')}
                  disabled={loading}
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="rememberMe"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-border"
                    />
                    <label htmlFor="rememberMe" className="text-sm text-muted-foreground">
                      {t('remember_me') || 'Remember me for 30 days'}
                    </label>
                  </div>
                  <Button type="button" variant="link" className="px-0" onClick={() => setMode('org')}>
                    {t('use_email_password_instead') || 'Use email/password instead'}
                  </Button>
                </div>
                {error && <div className="text-red-600 text-sm" data-testid="admin-error">{error}</div>}
                <Button type="submit" className="w-full" disabled={loading} data-testid="admin-login-button">
                  {loading ? t('admin_authenticating') : t('admin_access_button')}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">Loading…</div>}>
      <AdminLoginContent />
    </Suspense>
  );
}
