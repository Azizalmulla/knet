"use client"

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
 
import { useLanguage } from '@/lib/language'

interface Organization {
  id: string
  slug: string
  name: string
  logo_url?: string
  is_public: boolean
}

export default function CompanyPicker() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useLanguage()
  
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [filteredOrgs, setFilteredOrgs] = useState<Organization[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [lastOrg, setLastOrg] = useState<string | null>(null)
  // Keyboard navigation
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const gridRef = useRef<HTMLDivElement | null>(null)
  
  useEffect(() => {
    // Check for org query param
    const orgSlug = searchParams.get('org')
    if (orgSlug) {
      router.push(`/${orgSlug}/start`)
      return
    }
    
    // Check for last org cookie (only on client)
    if (typeof window !== 'undefined') {
      const cookies = document.cookie.split(';')
      const lastOrgCookie = cookies.find(c => c.trim().startsWith('last_org='))
      if (lastOrgCookie) {
        const slug = lastOrgCookie.split('=')[1]
        setLastOrg(slug)
      }
    }
    
    // Fetch public organizations
    fetchOrganizations()
  }, [searchParams, router])
  
  useEffect(() => {
    // Filter organizations based on search
    const filtered = organizations.filter(org => 
      org.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredOrgs(filtered)
  }, [searchTerm, organizations])
  
  const fetchOrganizations = async () => {
    try {
      const res = await fetch('/api/organizations/public')
      if (res.ok) {
        const data = await res.json()
        setOrganizations(data.organizations || [])
        setFilteredOrgs(data.organizations || [])
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const selectOrganization = (slug: string) => {
    // Set cookie (30 days)
    document.cookie = `last_org=${slug}; Path=/; Max-Age=${30 * 24 * 60 * 60}`
    router.push(`/${slug}/start`)
  }
  
  // Keyboard navigation: Arrow keys to move focus, Enter to select
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!filteredOrgs.length) return
    const cols = typeof window !== 'undefined'
      ? (window.innerWidth >= 1280 ? 5 : window.innerWidth >= 1024 ? 4 : window.innerWidth >= 768 ? 3 : 1)
      : 4
    let idx = focusedIndex < 0 ? 0 : focusedIndex
    if (e.key === 'ArrowRight') {
      idx = Math.min(idx + 1, filteredOrgs.length - 1)
      setFocusedIndex(idx)
      e.preventDefault()
    } else if (e.key === 'ArrowLeft') {
      idx = Math.max(idx - 1, 0)
      setFocusedIndex(idx)
      e.preventDefault()
    } else if (e.key === 'ArrowDown') {
      idx = Math.min(idx + cols, filteredOrgs.length - 1)
      setFocusedIndex(idx)
      e.preventDefault()
    } else if (e.key === 'ArrowUp') {
      idx = Math.max(idx - cols, 0)
      setFocusedIndex(idx)
      e.preventDefault()
    } else if (e.key === 'Enter') {
      if (idx >= 0 && idx < filteredOrgs.length) {
        selectOrganization(filteredOrgs[idx].slug)
      }
    }
  }

  useEffect(() => {
    if (focusedIndex < 0) return
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-index="${focusedIndex}"]`)
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [focusedIndex])
  
  const continueTolastOrg = () => {
    if (lastOrg) {
      router.push(`/${lastOrg}/start`)
    }
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-pulse text-white/70">Loading organizations...</div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 py-12">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3">
            {t('select_your_company') || 'Select Your Company'}
          </h1>
          <p className="text-white">
            {t('choose_org_to_submit') || 'Choose your organization to submit your CV'}
          </p>
        </div>
        
        {/* Last org compact pill */}
        {lastOrg && (
          <div className="mb-6">
            <Button onClick={continueTolastOrg} size="sm" variant="outline" className="rounded-full px-4 py-1.5 bg-white text-black border-white hover:bg-white/90">
              {((() => { const v = t('continue_to_last_org'); return v && v !== 'continue_to_last_org' ? v : 'Continue'; })()) + `: ${lastOrg}`}
            </Button>
          </div>
        )}
        
        {/* Search bar */}
        <div className="mb-8">
          <Input
            type="text"
            placeholder={t('search_companies') || 'Search companies...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-black border border-white/15 text-white placeholder:text-white rounded-2xl px-4 py-6 text-base"
          />
        </div>
        
        {/* Organizations Grid */}
        <div
          ref={gridRef}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="listbox"
          aria-label="Organizations"
          className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-10 outline-none"
        >
          {filteredOrgs.map((org, i) => (
            <Card
              key={org.id}
              data-index={i}
              role="option"
              aria-selected={focusedIndex === i}
              className={`group cursor-pointer transition-colors border border-white/15 bg-black supports-[backdrop-filter]:bg-black backdrop-blur-none rounded-2xl hover:bg-white/5 hover:border-white/25 ${focusedIndex === i ? 'ring-2 ring-white/40' : ''}`}
              onClick={() => selectOrganization(org.slug)}
            >
              <CardContent className="p-4 flex flex-col items-center text-center">
                <h3 className="font-semibold text-white text-lg tracking-tight">{org.name}</h3>
              </CardContent>
            </Card>
          ))}
        </div>
        
        {filteredOrgs.length === 0 && (
          <div className="text-center py-8 text-white">
            {t('no_companies_found') || 'No companies found'}
          </div>
        )}

      </div>
    </div>
  )
}
