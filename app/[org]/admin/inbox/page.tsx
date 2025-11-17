"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useRouter } from 'next/navigation'
import { Search, Send, Mail, ArrowLeft, Clock } from 'lucide-react'
import { toast } from 'sonner'

type Message = {
  id: string
  from_type: 'admin' | 'candidate'
  from_name: string
  from_email: string
  content: string
  created_at: string
}

type Thread = {
  id: string
  subject: string
  candidate_name: string
  candidate_email: string
  unread_count: number
  last_message_at: string
  messages?: Message[]
}

export default function InboxPage({ params }: { params: { org: string } }) {
  const router = useRouter()
  const orgSlug = params.org
  
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchThreads = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/${orgSlug}/admin/inbox`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setThreads(data.threads || [])
    } catch (err) {
      toast.error('Failed to load inbox')
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async (threadId: string) => {
    try {
      const res = await fetch(`/api/${orgSlug}/admin/inbox/${threadId}`)
      if (!res.ok) throw new Error('Failed to fetch messages')
      const data = await res.json()
      
      setThreads(prev => prev.map(t => 
        t.id === threadId 
          ? { ...t, messages: data.messages, unread_count: 0 }
          : t
      ))
    } catch (err) {
      toast.error('Failed to load messages')
    }
  }

  useEffect(() => {
    fetchThreads()
  }, [orgSlug])

  const handleExpand = (threadId: string) => {
    if (expandedId === threadId) {
      setExpandedId(null)
    } else {
      setExpandedId(threadId)
      const thread = threads.find(t => t.id === threadId)
      if (thread && !thread.messages) {
        fetchMessages(threadId)
      }
    }
  }

  const handleSendReply = async (threadId: string) => {
    if (!replyText.trim()) return

    try {
      setSending(true)
      const res = await fetch(`/api/${orgSlug}/admin/inbox/${threadId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: replyText })
      })

      if (!res.ok) throw new Error('Failed to send')

      toast.success('Reply sent!')
      setReplyText('')
      setReplyingTo(null)
      
      // Refresh messages
      await fetchMessages(threadId)
    } catch (err) {
      toast.error('Failed to send reply')
    } finally {
      setSending(false)
    }
  }

  const filteredThreads = threads.filter(t =>
    searchQuery === '' ||
    t.candidate_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.candidate_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.subject.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#eeeee4] p-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111]"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#eeeee4]">
      {/* Header */}
      <div className="bg-white border-b-[4px] border-black shadow-[8px_8px_0_#111] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => router.push(`/${orgSlug}/admin`)}
              className="rounded-xl border-[3px] border-black bg-white text-black shadow-[4px_4px_0_#111] hover:-translate-y-0.5 transition-all font-bold"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="text-3xl font-bold">📧 Inbox</h1>
          </div>
          {threads.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-600">
                {threads.filter(t => t.unread_count > 0).length} unread
              </span>
              <Button
                onClick={fetchThreads}
                variant="outline"
                size="sm"
                className="rounded-xl border-[2px] border-black shadow-[3px_3px_0_#111] hover:-translate-y-0.5 transition-all font-bold"
              >
                Refresh
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Search */}
        {threads.length > 0 && (
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search by name, email, or subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 rounded-xl border-[3px] border-black shadow-[4px_4px_0_#111] font-medium text-base"
              />
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredThreads.length === 0 && !loading && (
          <div className="rounded-2xl border-[3px] border-dashed border-black bg-white p-12 text-center shadow-[6px_6px_0_#111]">
            <Mail className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Messages Yet</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              When candidates reply to your emails from the AI Agent, their messages will appear here automatically.
            </p>
            <div className="rounded-xl border-[3px] border-black bg-[#ffd6a5] p-6 max-w-md mx-auto text-left shadow-[4px_4px_0_#111]">
              <p className="text-xs font-bold text-gray-900 uppercase mb-3">💡 How It Works</p>
              <ul className="text-sm text-gray-700 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="font-bold">1.</span>
                  <span>Use the AI Agent to email candidates</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">2.</span>
                  <span>Candidates reply to those emails</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">3.</span>
                  <span>Replies show up here automatically</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold">4.</span>
                  <span>Respond directly from this inbox</span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Thread List */}
        <div className="space-y-4">
          {filteredThreads.map((thread) => {
            const isExpanded = expandedId === thread.id
            const hasUnread = thread.unread_count > 0

            return (
              <div
                key={thread.id}
                className={`rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111] hover:shadow-[8px_8px_0_#111] hover:-translate-y-1 transition-all ${
                  hasUnread ? 'bg-[#e0f2ff]' : ''
                }`}
              >
                {/* Thread Header */}
                <div
                  className="p-6 cursor-pointer"
                  onClick={() => handleExpand(thread.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl border-[3px] border-black bg-[#a7f3d0] flex items-center justify-center font-bold text-lg shadow-[3px_3px_0_#111]">
                          {thread.candidate_name[0].toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">{thread.candidate_name}</h3>
                          <p className="text-sm text-gray-600">{thread.candidate_email}</p>
                        </div>
                        {hasUnread && (
                          <span className="px-2 py-1 rounded-lg border-[2px] border-black bg-[#ffd6a5] text-xs font-bold shadow-[2px_2px_0_#111]">
                            {thread.unread_count} new
                          </span>
                        )}
                      </div>
                      <p className={`text-base ${hasUnread ? 'font-bold' : 'text-gray-700'}`}>
                        {thread.subject}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4" />
                      {formatTime(thread.last_message_at)}
                    </div>
                  </div>
                </div>

                {/* Expanded Messages */}
                {isExpanded && thread.messages && (
                  <div className="border-t-[3px] border-black p-6 bg-gray-50">
                    {/* Messages */}
                    <div className="space-y-4 mb-6">
                      {thread.messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`rounded-xl border-[3px] border-black p-4 shadow-[4px_4px_0_#111] ${
                            msg.from_type === 'candidate'
                              ? 'bg-white'
                              : 'bg-[#bde0fe]'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-sm">
                              {msg.from_type === 'candidate' ? '👤' : '👔'} {msg.from_name}
                            </span>
                            <span className="text-xs text-gray-600">
                              {formatTime(msg.created_at)}
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {msg.content}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Reply Form */}
                    {replyingTo === thread.id ? (
                      <div className="space-y-3">
                        <Textarea
                          placeholder="Type your reply..."
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          rows={4}
                          className="rounded-xl border-[3px] border-black shadow-[4px_4px_0_#111] font-medium resize-none"
                        />
                        <div className="flex gap-3">
                          <Button
                            onClick={() => handleSendReply(thread.id)}
                            disabled={!replyText.trim() || sending}
                            className="rounded-xl border-[3px] border-black bg-[#a7f3d0] text-black shadow-[4px_4px_0_#111] hover:-translate-y-0.5 transition-all font-bold"
                          >
                            <Send className="w-4 h-4 mr-2" />
                            {sending ? 'Sending...' : 'Send Reply'}
                          </Button>
                          <Button
                            onClick={() => {
                              setReplyingTo(null)
                              setReplyText('')
                            }}
                            variant="outline"
                            className="rounded-xl border-[3px] border-black bg-white shadow-[4px_4px_0_#111] hover:-translate-y-0.5 transition-all font-bold"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        onClick={() => setReplyingTo(thread.id)}
                        className="rounded-xl border-[3px] border-black bg-[#bde0fe] text-black shadow-[4px_4px_0_#111] hover:-translate-y-0.5 transition-all font-bold"
                      >
                        Reply
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
