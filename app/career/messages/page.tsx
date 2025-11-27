'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  MessageSquare, Send, ChevronLeft, Building2, Clock, 
  Loader2, RefreshCw, Inbox, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Thread {
  id: string;
  subject: string;
  candidate_name: string;
  org_name: string;
  org_slug: string;
  org_logo: string | null;
  unread_count: number;
  last_message_at: string;
  message_count: number;
}

interface Message {
  id: string;
  sender_type: 'admin' | 'candidate';
  sender_name: string;
  sender_email: string;
  content: string;
  created_at: string;
}

export default function CandidateMessagesPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    fetchThreads();
  }, []);

  const fetchThreads = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/candidate/messages');
      if (!res.ok) throw new Error('Failed to load messages');
      const data = await res.json();
      setThreads(data.threads || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openThread = async (thread: Thread) => {
    setSelectedThread(thread);
    setLoadingMessages(true);
    setMessages([]);
    try {
      const res = await fetch(`/api/candidate/messages/${thread.id}`);
      if (!res.ok) throw new Error('Failed to load conversation');
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendReply = async () => {
    if (!selectedThread || !replyText.trim()) return;
    
    setSending(true);
    try {
      const res = await fetch(`/api/candidate/messages/${selectedThread.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: replyText.trim() })
      });
      
      if (!res.ok) throw new Error('Failed to send message');
      
      const data = await res.json();
      setMessages(prev => [...prev, data.message]);
      setReplyText('');
      toast.success('Message sent!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#eeeee4] p-8">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111] p-12 text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
            <p className="font-bold">Loading messages...</p>
          </div>
        </div>
      </div>
    );
  }

  // Thread list view
  if (!selectedThread) {
    return (
      <div className="min-h-screen bg-[#eeeee4] p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <Link href="/career/dashboard" className="text-sm text-gray-600 hover:text-black flex items-center gap-1 mb-2">
                <ArrowLeft className="w-4 h-4" /> Back to Dashboard
              </Link>
              <h1 className="text-3xl font-black">Messages</h1>
              <p className="text-gray-600">Your conversations with employers</p>
            </div>
            <Button
              onClick={fetchThreads}
              className="rounded-xl border-[3px] border-black bg-white text-black shadow-[3px_3px_0_#111] hover:-translate-y-0.5 transition-all font-bold"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Thread List */}
          {threads.length === 0 ? (
            <div className="rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111] p-12 text-center">
              <Inbox className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">No messages yet</h3>
              <p className="text-gray-600">
                When employers message you, they'll appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {threads.map((thread) => (
                <button
                  key={thread.id}
                  onClick={() => openThread(thread)}
                  className="w-full text-left rounded-2xl border-[3px] border-black bg-white shadow-[4px_4px_0_#111] hover:shadow-[2px_2px_0_#111] hover:-translate-y-0.5 transition-all p-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl border-[2px] border-black bg-[#FFEACC] flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold truncate">{thread.subject}</h3>
                          <p className="text-sm text-gray-600">{thread.org_name}</p>
                        </div>
                        {thread.unread_count > 0 && (
                          <span className="px-2 py-1 rounded-full bg-red-500 text-white text-xs font-bold">
                            {thread.unread_count}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {thread.message_count} messages
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {thread.last_message_at ? format(new Date(thread.last_message_at), 'MMM d, h:mm a') : 'No messages'}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Conversation view
  return (
    <div className="min-h-screen bg-[#eeeee4] flex flex-col">
      {/* Header */}
      <div className="bg-white border-b-[3px] border-black p-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Button
            onClick={() => setSelectedThread(null)}
            variant="ghost"
            className="p-2"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div className="flex-1">
            <h2 className="font-bold">{selectedThread.subject}</h2>
            <p className="text-sm text-gray-600">{selectedThread.org_name}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {loadingMessages ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p className="text-gray-600">Loading conversation...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-600">No messages in this conversation yet</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender_type === 'candidate' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl border-[3px] border-black p-4 ${
                    msg.sender_type === 'candidate'
                      ? 'bg-black text-white'
                      : 'bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold text-sm">{msg.sender_name}</span>
                    <span className={`text-xs ${msg.sender_type === 'candidate' ? 'text-gray-300' : 'text-gray-500'}`}>
                      {format(new Date(msg.created_at), 'MMM d, h:mm a')}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Reply Input */}
      <div className="bg-white border-t-[3px] border-black p-4">
        <div className="max-w-4xl mx-auto flex gap-3">
          <Input
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 rounded-xl border-[3px] border-black"
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendReply()}
          />
          <Button
            onClick={sendReply}
            disabled={sending || !replyText.trim()}
            className="rounded-xl border-[3px] border-black bg-black text-white shadow-[3px_3px_0_#111] hover:shadow-[1px_1px_0_#111] hover:-translate-y-0.5 transition-all font-bold px-6"
          >
            {sending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
