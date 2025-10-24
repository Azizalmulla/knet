"use client"

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useRouter } from 'next/navigation'
import { Search, Archive, ExternalLink, Send, Filter, RefreshCw } from 'lucide-react'

// Mock data - empty until real emails come in
const mockEmails: Array<{
  id: string
  candidateName: string
  candidateEmail: string
  subject: string
  preview: string
  timestamp: string
  unread: boolean
  messages: Array<{
    from: string
    content: string
    timestamp: string
  }>
}> = []

export default function InboxPage({ params }: { params: { org: string } }) {
  const router = useRouter()
  const orgSlug = params.org
  
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    // TODO: Fetch real inbox data from API
    setTimeout(() => setRefreshing(false), 500)
  }

  const filteredEmails = mockEmails.filter(email => {
    const matchesFilter = filter === 'all' || email.unread
    const matchesSearch = searchQuery === '' || 
      email.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.subject.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const handleSendReply = (emailId: string) => {
    console.log('Sending reply to', emailId, ':', replyText)
    // TODO: Wire up to API
    setReplyText('')
    setReplyingTo(null)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/${orgSlug}/admin`)}
            >
              Back
            </Button>
            <h1 className="text-2xl font-bold">Inbox</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            {mockEmails.length > 0 && (
              <Badge variant="secondary">{filteredEmails.filter(e => e.unread).length} unread</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Toolbar - only show when there are emails */}
        {mockEmails.length > 0 && (
          <div className="mb-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
              >
                All
              </Button>
              <Button
                variant={filter === 'unread' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('unread')}
              >
                Unread
              </Button>
            </div>
          </div>
        )}

        {/* Email List - Notion Style */}
        <div className="border rounded-lg overflow-hidden bg-card">
          {filteredEmails.length === 0 && (
            <div className="p-12 text-center">
              <div className="mx-auto max-w-md space-y-4">
                <div className="w-16 h-16 mx-auto rounded-lg bg-muted grid place-items-center">
                  <Search className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">No messages yet</h3>
                  <p className="text-sm text-muted-foreground">
                    When candidates reply to your emails from the AI Agent, their messages will appear here.
                  </p>
                </div>
                <div className="pt-4 space-y-2 text-left bg-muted/30 rounded-lg p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase">How it works</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Use the AI Agent to email candidates</li>
                    <li>• Candidates reply to those emails</li>
                    <li>• Their replies show up here automatically</li>
                    <li>• Respond directly from this inbox</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
          
          {filteredEmails.map((email, idx) => (
            <div key={email.id}>
              {/* Email Row */}
              <div
                className={`group relative transition-colors hover:bg-accent/50 ${
                  expandedId === email.id ? 'bg-accent/30' : ''
                } ${idx !== 0 ? 'border-t' : ''}`}
              >
                {/* Unread indicator */}
                {email.unread && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                )}

                <div
                  className="flex items-start gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === email.id ? null : email.id)}
                >
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-md bg-primary/10 grid place-items-center font-medium text-xs flex-shrink-0 mt-0.5">
                    {email.candidateName[0]}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-sm font-medium ${
                            email.unread ? 'text-foreground' : 'text-muted-foreground'
                          }`}>
                            {email.candidateName}
                          </span>
                          {email.unread && (
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                          )}
                        </div>
                        <p className={`text-sm ${
                          email.unread ? 'font-medium' : 'text-muted-foreground'
                        }`}>
                          {email.subject}
                        </p>
                        {expandedId !== email.id && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                            {email.preview}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0 mt-0.5">
                        {email.timestamp}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded Thread */}
                {expandedId === email.id && (
                  <div className="px-4 pb-4 space-y-3">
                    {/* Thread Messages */}
                    <div className="ml-11 space-y-3 pt-2">
                      {email.messages.map((msg, idx) => (
                        <div key={idx} className="rounded-md bg-muted/50 p-3 text-sm">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-xs">{msg.from}</span>
                            <span className="text-xs text-muted-foreground">{msg.timestamp}</span>
                          </div>
                          <p className="text-sm leading-relaxed">{msg.content}</p>
                        </div>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="ml-11 pt-2">
                      {replyingTo === email.id ? (
                        <div className="space-y-2">
                          <Textarea
                            placeholder="Type your reply..."
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            rows={3}
                            className="resize-none text-sm"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSendReply(email.id)}
                              disabled={!replyText.trim()}
                            >
                              <Send className="h-3 w-3 mr-1" />
                              Send
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setReplyingTo(null)
                                setReplyText('')
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setReplyingTo(email.id)}
                          >
                            Reply
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => router.push(`/${orgSlug}/admin?search=${email.candidateEmail}`)}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View Profile
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                          >
                            <Archive className="h-3 w-3 mr-1" />
                            Archive
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
