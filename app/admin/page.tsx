"use client";

import { useState, useEffect } from 'react';
import AdminDashboard from '@/components/admin-dashboard';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useInactivityTimeout } from '@/lib/useInactivityTimeout';
import { useLanguage } from '@/lib/language';

function AdminLogin({ onLogin }: { onLogin: (token: string) => void }) {
  const { t } = useLanguage();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        sessionStorage.setItem('admin_token', token);
        onLogin(token);
      } else {
        setError(t('admin_invalid_key'));
      }
    } catch (err) {
      setError(t('admin_connection_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('admin_access')}</CardTitle>
          <CardDescription>{t('admin_enter_key')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <Input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={t('enter_admin_key')}
                disabled={loading}
                data-testid="admin-key-input"
              />
              {error && <div className="text-red-600 text-sm" data-testid="admin-error">{error}</div>}
              <Button type="submit" className="w-full" disabled={loading} data-testid="admin-login-button">
                {loading ? t('admin_authenticating') : t('admin_access_button')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminContent() {
  const { t } = useLanguage();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState<boolean>(true);

  // Auto-logout after 30 minutes of inactivity
  useInactivityTimeout({
    timeoutMs: 30 * 60 * 1000, // 30 minutes
    onTimeout: () => {
      if (isAuthenticated) {
        sessionStorage.removeItem('admin_token');
        setIsAuthenticated(false);
        
        // Show inactivity timeout message
        const toast = document.createElement('div');
        toast.textContent = t('admin_session_expired');
        toast.style.cssText = `
          position: fixed; top: 20px; right: 20px; z-index: 9999;
          background: #f59e0b; color: white; padding: 12px 24px;
          border-radius: 8px; font-size: 14px; font-weight: 500;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.remove(), 5000);
      }
    },
    enabled: isAuthenticated
  });

  useEffect(() => {
    const token = sessionStorage.getItem('admin_token');
    setIsAuthenticated(!!token);
    setLoading(false);
  }, []);

  // Initialize theme from localStorage and apply to <html>
  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
      const isDark = saved !== 'light';
      setDarkMode(isDark);
      if (isDark) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
    } catch {}
  }, []);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (next) {
      document.documentElement.classList.add('dark');
      try { localStorage.setItem('theme', 'dark'); } catch {}
    } else {
      document.documentElement.classList.remove('dark');
      try { localStorage.setItem('theme', 'light'); } catch {}
    }
  };

  const handleLogin = (token: string) => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_token');
    setIsAuthenticated(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div>{t('admin_loading')}</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="p-4 flex items-center justify-between">
        <Button 
          variant="outline" 
          onClick={handleLogout}
          className="mb-4"
          data-testid="admin-logout-button"
        >
          {t('admin_logout')}
        </Button>
        {/* Dark mode toggle */}
        <div className="mb-4 flex items-center gap-3" title="Toggle dark mode">
          <input id="checkboxInput" type="checkbox" checked={darkMode} onChange={toggleDarkMode} />
          <label htmlFor="checkboxInput" className="toggleSwitch" aria-label="Toggle dark mode" />
        </div>
      </div>
      <AdminDashboard />
    </div>
  );
}

export default function AdminPage() {
  const { t } = useLanguage();
  return (
    <ErrorBoundary
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>{t('system_error')}</CardTitle>
              <CardDescription>{t('admin_error_message')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => window.location.reload()} className="w-full">
                {t('reload_page')}
              </Button>
            </CardContent>
          </Card>
        </div>
      }
    >
      <AdminContent />
    </ErrorBoundary>
  );
}
