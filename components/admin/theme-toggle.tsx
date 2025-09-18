'use client'

import { useTheme } from 'next-themes'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useEffect, useState } from 'react'

export function AdminThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => setMounted(true), [])

  // Avoid hydration mismatch
  if (!mounted) return null

  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={theme === 'dark'}
        onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
        aria-label="Toggle dark mode"
        data-testid="admin-dark-toggle"
      />
      <Label className="text-sm text-muted-foreground">
        {theme === 'dark' ? 'Dark' : 'Light'}
      </Label>
    </div>
  )
}
