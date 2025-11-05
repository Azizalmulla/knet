"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, Users, Search, Check } from 'lucide-react'
import { toast } from 'sonner'

type Candidate = {
  id: string
  full_name: string
  email: string
  phone: string
  field_of_study?: string
}

type Template = {
  id: string
  title: string
  question_count: number
}

export default function InviteCandidatesModal({
  orgSlug,
  template,
  onClose,
  onSuccess
}: {
  orgSlug: string
  template: Template
  onClose: () => void
  onSuccess: () => void
}) {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [expiryDays, setExpiryDays] = useState(7)

  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/${orgSlug}/admin/students`)
        
        if (!res.ok) throw new Error('Failed to fetch candidates')
        
        const data = await res.json()
        setCandidates(data.students || [])
      } catch (err) {
        toast.error('Failed to load candidates')
      } finally {
        setLoading(false)
      }
    }

    fetchCandidates()
  }, [orgSlug])

  const filteredCandidates = candidates.filter(c =>
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  )

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selected)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelected(newSelected)
  }

  const selectAll = () => {
    if (selected.size === filteredCandidates.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filteredCandidates.map(c => c.id)))
    }
  }

  const handleInvite = async () => {
    if (selected.size === 0) {
      toast.error('Select at least one candidate')
      return
    }

    try {
      setSending(true)
      const res = await fetch(`/api/${orgSlug}/admin/interview-templates/${template.id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_ids: Array.from(selected),
          expires_in_days: expiryDays
        })
      })

      if (!res.ok) throw new Error('Failed to invite candidates')

      const data = await res.json()
      toast.success(`Invited ${data.invited_count} candidate(s) to interview`)
      onSuccess()
    } catch (err) {
      toast.error('Failed to send invitations')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border-[4px] border-black bg-white shadow-[12px_12px_0_#111] flex flex-col">
        {/* Header */}
        <div className="bg-white border-b-[3px] border-black p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl border-[3px] border-black bg-[#a7f3d0] flex items-center justify-center shadow-[3px_3px_0_#111]">
              <Users className="w-5 h-5 text-black" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Invite Candidates</h2>
              <p className="text-sm text-gray-600">{template.title} • {template.question_count} questions</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="rounded-xl hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Search & Select All */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search candidates..."
                className="pl-10 rounded-xl border-[3px] border-black shadow-[3px_3px_0_#111] font-medium"
              />
            </div>

            <div className="flex items-center justify-between">
              <Button
                onClick={selectAll}
                variant="outline"
                size="sm"
                className="rounded-xl border-[2px] border-black bg-white shadow-[3px_3px_0_#111] hover:-translate-y-0.5 transition-all font-bold"
              >
                {selected.size === filteredCandidates.length ? 'Deselect All' : 'Select All'}
              </Button>
              <span className="text-sm font-semibold text-gray-600">
                {selected.size} selected
              </span>
            </div>
          </div>

          {/* Expiry Settings */}
          <div className="rounded-xl border-[3px] border-black bg-[#ffd6a5] p-4 shadow-[4px_4px_0_#111]">
            <label className="block text-sm font-bold text-gray-900 mb-2">
              Interview Expires In:
            </label>
            <select
              value={expiryDays}
              onChange={(e) => setExpiryDays(parseInt(e.target.value))}
              className="w-full rounded-lg border-[2px] border-black bg-white px-3 py-2 text-sm font-medium"
            >
              <option value={3}>3 days</option>
              <option value={7}>7 days (recommended)</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
            </select>
          </div>

          {/* Candidates List */}
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 rounded-xl border-[3px] border-black bg-gray-100 animate-pulse"></div>
              ))}
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              No candidates found
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCandidates.map((candidate) => (
                <div
                  key={candidate.id}
                  onClick={() => toggleSelect(candidate.id)}
                  className={`rounded-xl border-[3px] border-black p-4 cursor-pointer transition-all hover:-translate-y-0.5 ${
                    selected.has(candidate.id)
                      ? 'bg-[#a7f3d0] shadow-[4px_4px_0_#111]'
                      : 'bg-white shadow-[3px_3px_0_#111]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-bold text-gray-900">{candidate.full_name}</div>
                      <div className="text-sm text-gray-600">{candidate.email}</div>
                      {candidate.field_of_study && (
                        <div className="text-xs text-gray-500 mt-1">{candidate.field_of_study}</div>
                      )}
                    </div>
                    {selected.has(candidate.id) && (
                      <div className="w-6 h-6 rounded-full border-[2px] border-black bg-black flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white border-t-[3px] border-black p-6 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {selected.size} candidate(s) will receive interview invitation
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="rounded-xl border-[3px] border-black bg-white text-gray-700 shadow-[4px_4px_0_#111] hover:-translate-y-0.5 transition-all font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={sending || selected.size === 0}
              className="rounded-xl border-[3px] border-black bg-[#a7f3d0] text-black shadow-[4px_4px_0_#111] hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#111] transition-all font-bold"
            >
              {sending ? 'Sending...' : `Send ${selected.size} Invitation${selected.size !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
