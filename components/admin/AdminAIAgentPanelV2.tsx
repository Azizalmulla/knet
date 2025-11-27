'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ArrowUp } from 'lucide-react';
import { adminFetch } from '@/lib/admin-fetch';
import { useLanguage } from '@/lib/language';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export function AdminAIAgentPanelV2({ orgSlug: orgProp }: { orgSlug?: string } = {}) {
  const { t } = useLanguage();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: '👋 Hi! I\'m your AI recruiting assistant. I can help you find candidates, analyze their profiles, and compare them. What are you looking for today?'
    }
  ]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const resolveOrg = (): string | null => {
    if (orgProp && orgProp.trim()) return orgProp.trim();
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const qp = sp.get('org');
      if (qp && qp.trim()) return qp.trim();
      const ss = window.sessionStorage?.getItem('current_org');
      if (ss && ss.trim()) return ss.trim();
      const m = window.location.pathname.match(/^\/(.+?)\/admin/);
      if (m && m[1]) return m[1];
    }
    return null;
  };

  const submitMessage = async () => {
    const userMessage = message.trim();
    if (!userMessage || loading) return;

    setMessage('');
    setError(null);
    setLoading(true);

    // Add user message
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      const org = resolveOrg();
      if (!org) throw new Error('ADMIN_ORG_MISSING');
      
      // Send to natural conversation API (v2)
      const history = chatHistory.map(msg => ({
        role: msg.role === 'system' ? 'user' : msg.role,
        content: msg.content
      }));
      
      const data = await adminFetch(`/api/admin/agent/query-v2?org=${org}`, {
        method: 'POST',
        body: JSON.stringify({ 
          message: userMessage,
          history: history
        })
      });

      // Add assistant response
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: data.response || 'I apologize, but I couldn\'t process that request.'
      }]);

    } catch (err: any) {
      const msg = String(err?.message || 'An error occurred');
      setError(msg);
      setChatHistory(prev => [...prev, {
        role: 'system',
        content: `Error: ${msg}`
      }]);
    } finally {
      setLoading(false);
    }
  };

  const clearConversation = () => {
    if (confirm('Clear conversation history?')) {
      setChatHistory([{
        role: 'assistant',
        content: '👋 Hi! I\'m your AI recruiting assistant. What are you looking for today?'
      }]);
      setError(null);
      setMessage('');
    }
  };

  // Auto-scroll
  useEffect(() => {
    const el = chatEndRef.current;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chatHistory, loading]);

  // Simple markdown renderer
  const renderMarkdown = (text: string) => {
    return text.split('\n').map((line, i) => {
      // Bold
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      const formatted = parts.map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={j}>{part.slice(2, -2)}</strong>;
        }
        return <span key={j}>{part}</span>;
      });
      
      return <div key={i}>{formatted}</div>;
    });
  };

  return (
    <div className="h-full w-full flex flex-col">
      {/* Header */}
      {chatHistory.length > 1 && (
        <div className="flex justify-between items-center px-4 md:px-6 pt-4 pb-2">
          <div className="text-sm text-muted-foreground">
            Natural Conversation Mode
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={clearConversation}
            className="border-2 border-black hover:bg-gray-100"
          >
            Clear Chat
          </Button>
        </div>
      )}

      {/* Messages */}
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-6 pb-40">
        <div className="mx-auto w-full max-w-3xl space-y-6">
        {chatHistory.map((msg, idx) => {
          if (msg.role === 'user') {
            return (
              <div key={idx} className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl bg-primary text-primary-foreground px-4 py-3 shadow-sm">
                  <div className="text-[10px] uppercase tracking-wide opacity-80 mb-1">You</div>
                  <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                </div>
              </div>
            );
          }
          
          if (msg.role === 'system') {
            return (
              <div key={idx} className="flex justify-center">
                <div className="max-w-[85%] rounded-xl border border-destructive/40 bg-destructive/10 text-destructive px-3 py-2 text-sm">
                  {msg.content}
                </div>
              </div>
            );
          }
          
          // Assistant message
          return (
            <div key={idx} className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl bg-white border-[3px] border-black px-5 py-4 shadow-[6px_6px_0_#111]">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">AI Recruiter</div>
                <div className="text-sm leading-relaxed space-y-2">
                  {renderMarkdown(msg.content)}
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl bg-white border-[3px] border-black px-5 py-4 shadow-[6px_6px_0_#111]">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t-[4px] border-black shadow-[0_-8px_0_#111]">
        <div className="mx-auto w-full max-w-3xl px-4 py-4">
          <div className="flex items-end gap-3">
            <div className="flex-1 rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111] px-4 py-3 transition-transform focus-within:-translate-y-1">
              <Textarea
                placeholder="Ask me anything about your candidates..."
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  const ta = e.currentTarget as HTMLTextAreaElement;
                  ta.style.height = 'auto';
                  ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
                }}
                rows={1}
                className="w-full resize-none min-h-[40px] max-h-[200px] rounded-xl bg-transparent border-0 focus-visible:ring-0 focus-visible:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submitMessage();
                  }
                }}
              />
            </div>
            <Button
              onClick={submitMessage}
              disabled={loading || !message.trim()}
              className="h-10 w-10 rounded-full bg-black text-white hover:bg-gray-800 disabled:bg-gray-300 disabled:text-gray-500 transition-colors flex items-center justify-center p-0"
              >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
              )}
            </Button>
          </div>
          
          {/* Example prompts */}
          {chatHistory.length === 1 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => setMessage('Find React developers with 3+ years experience')}
                className="px-3 py-1.5 text-xs rounded-lg border-2 border-black/10 hover:border-black/30 hover:bg-gray-50 transition-colors"
              >
                Find React devs
              </button>
              <button
                onClick={() => setMessage('Show me designers with strong portfolios')}
                className="px-3 py-1.5 text-xs rounded-lg border-2 border-black/10 hover:border-black/30 hover:bg-gray-50 transition-colors"
              >
                Find designers
              </button>
              <button
                onClick={() => setMessage('I need someone with leadership experience')}
                className="px-3 py-1.5 text-xs rounded-lg border-2 border-black/10 hover:border-black/30 hover:bg-gray-50 transition-colors"
              >
                Find leaders
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
