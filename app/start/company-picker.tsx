"use client"

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CheckCircle, Mic } from 'lucide-react'
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
  // Removed last-org quick-continue pill per request
  // Keyboard navigation
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const selectedSlugs = useMemo(() => Object.keys(selected).filter(k => selected[k]), [selected])
  const selectedCount = selectedSlugs.length
  const MAX_BULK = 50
  
  useEffect(() => {
    // If ?org= is present, keep legacy deep-link behavior (single org)
    const orgSlug = searchParams.get('org')
    if (orgSlug) {
      router.push(`/${orgSlug}/start`)
      return
    }
    
    // Removed last_org pill logic
    
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
  
  const toggleSelect = (slug: string) => {
    setSelected(prev => ({ ...prev, [slug]: !prev[slug] }))
  }

  const setSelectAllFiltered = () => {
    const limit = Math.min(MAX_BULK, filteredOrgs.length)
    const next: Record<string, boolean> = {}
    for (let i = 0; i < limit; i++) next[filteredOrgs[i].slug] = true
    setSelected(next)
  }

  const clearSelection = () => setSelected({})

  const proceedSubmit = (mode: 'upload' | 'ai' | 'voice') => {
    if (selectedCount === 0) return
    if (selectedCount > MAX_BULK) {
      alert(`You can select up to ${MAX_BULK} companies at once.`)
      return
    }
    // For AI or Voice, if exactly one org is selected, go directly with org preserved
    if ((mode === 'ai' || mode === 'voice') && selectedCount === 1) {
      const slug = selectedSlugs[0]
      if (mode === 'voice') {
        router.push(`/voice-cv?org=${encodeURIComponent(slug)}`)
      } else {
        router.push(`/career/ai-builder?org=${encodeURIComponent(slug)}`)
      }
      return
    }
    // Otherwise (upload, or AI with multiple), use bulk submit flow
    if (selectedCount > 1) {
      const ok = confirm(`You are about to send your CV to ${selectedCount} companies. Are you sure?`)
      if (!ok) return
    }
    const qs = new URLSearchParams()
    qs.set('orgs', selectedSlugs.join(','))
    qs.set('mode', mode)
    router.push(`/bulk-submit?${qs.toString()}`)
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
        toggleSelect(filteredOrgs[idx].slug)
      }
    }
  }

  useEffect(() => {
    if (focusedIndex < 0) return
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-index="${focusedIndex}"]`)
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [focusedIndex])
  
  // Removed continue to last org handler
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#eeeee4] text-neutral-900 flex items-center justify-center">
        <div className="animate-pulse text-neutral-600">Loading organizations...</div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-[#eeeee4] text-neutral-900">
      <div className="mx-auto max-w-6xl px-4 py-12">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3">
            {t('which_companies_interested')}
          </h1>
          <p className="text-neutral-700">
            {t('select_companies_submit')}
          </p>
        </div>
        
        {/* Removed 'Continue: last org' pill */}
        
        {/* Search bar */}
        <div className="mb-8">
          <Input
            type="text"
            placeholder={t('search_companies') || 'Search companies...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-white border-[3px] border-black text-black placeholder:text-neutral-500 rounded-2xl px-4 py-6 text-base shadow-[6px_6px_0_#111]"
          />
        </div>
        
        {/* Bulk actions */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={setSelectAllFiltered} className="rounded-2xl border-[3px] border-black bg-white text-black shadow-[6px_6px_0_#111] hover:-translate-y-0.5 hover:bg-zinc-100 transition-transform">Select All</Button>
            <Button size="sm" variant="ghost" onClick={clearSelection} disabled={selectedCount === 0} className="text-neutral-700 hover:text-black disabled:opacity-50 disabled:cursor-not-allowed">Clear</Button>
            <span className="text-sm text-neutral-700 font-medium">
              {selectedCount > 0 ? (
                <span className="text-black font-bold">{selectedCount} selected</span>
              ) : (
                'No companies selected'
              )}
              {selectedCount > MAX_BULK && <span className="text-red-600"> (max {MAX_BULK})</span>}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch gap-2">
            <Button 
              size="sm" 
              className="rounded-2xl border-[3px] border-black bg-white text-black shadow-[6px_6px_0_#111] hover:-translate-y-0.5 hover:bg-zinc-100 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0" 
              disabled={selectedCount === 0} 
              onClick={() => proceedSubmit('upload')}
            >
              Upload CV {selectedCount > 0 && `(${selectedCount})`}
            </Button>
            <Button 
              size="sm" 
              className="rounded-2xl border-[3px] border-black bg-[#ffd6a5] text-black shadow-[6px_6px_0_#111] hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0" 
              disabled={selectedCount === 0} 
              onClick={() => proceedSubmit('ai')}
            >
              Build with AI {selectedCount > 0 && `(${selectedCount})`}
            </Button>
            <Button 
              size="sm" 
              className="rounded-2xl border-[3px] border-black bg-gradient-to-br from-[#e0c3fc] to-[#8ec5fc] text-black font-bold shadow-[6px_6px_0_#111] hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0" 
              disabled={selectedCount === 0} 
              onClick={() => proceedSubmit('voice')}
            >
              <Mic className="w-4 h-4 mr-1" />
              Voice-to-CV {selectedCount > 0 && `(${selectedCount})`}
            </Button>
          </div>
        </div>

        {/* Organizations Grid */}
        <div
          ref={gridRef}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="listbox"
          aria-label="Organizations"
          aria-multiselectable="true"
          className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-10 outline-none"
        >
          {filteredOrgs.map((org, i) => {
            const isSelected = !!selected[org.slug]
            return (
              <Card
                key={org.id}
                data-index={i}
                role="option"
                aria-selected={isSelected}
                onClick={() => toggleSelect(org.slug)}
                className={`group cursor-pointer transition-all rounded-2xl border-[3px] border-black hover:-translate-y-1 ${
                  isSelected 
                    ? 'bg-[#ffd6a5] shadow-[8px_8px_0_#111]' 
                    : 'bg-white shadow-[6px_6px_0_#111] hover:bg-neutral-50'
                } ${focusedIndex === i ? 'ring-2 ring-black/50' : ''}`}
              >
                <CardContent className="p-4 flex flex-col items-center text-center relative">
                  {isSelected && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle className="w-6 h-6 text-black" fill="#ffd6a5" />
                    </div>
                  )}
                  <div className="w-full flex items-center justify-between">
                    <h3 className="font-semibold text-black text-lg tracking-tight text-left pr-8">{org.name}</h3>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
        
        {filteredOrgs.length === 0 && (
          <div className="text-center py-8 text-neutral-700">
            {t('no_companies_found') || 'No companies found'}
          </div>
        )}

      </div>
      
    </div>
  )
}
