'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, SendHorizontal, Copy, Loader2 } from 'lucide-react';
import { adminFetch } from '@/lib/admin-fetch';
import { useLanguage } from '@/lib/language';

interface QueryResult {
  id: string;
  fullName: string;
  email: string;
  fieldOfStudy: string;
  gpa?: number;
  experienceCount?: number;
  projectHighlights?: string[];
  awards?: string[];
  score: number;
  whyPicked?: string;
  matchedSkills?: string[];
  cv_url_pdf?: string | null;
  cv_url_html?: string | null;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  results?: QueryResult[];
  explanation?: string;
  filtersApplied?: any;
  needsClarification?: boolean;
  tips?: string[];
}

export function AdminAIAgentPanel() {
  const { t } = useLanguage();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [pendingRetryMessage, setPendingRetryMessage] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Auto-retry with stored admin key if available
  const submitInternal = async (userMessage: string, pushUserBubble = true, retryCount = 0) => {
    if (!userMessage.trim() || loading) return;

    if (pushUserBubble) {
      setMessage('');
    }
    setError(null);
    setLoading(true);

    // Add user message to chat
    if (pushUserBubble) {
      setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
    }

    try {
      const data = await adminFetch('/api/admin/agent/query', {
        method: 'POST',
        body: JSON.stringify({ message: userMessage })
      });

      // Add assistant response to chat
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: data.needsClarification ? data.clarifyQuestion : 
                 data.results?.length > 0 ? data.explanation || t('ai_found_matches') :
                 data.explanation || 'No strong matches found.',
        results: data.results,
        explanation: data.explanation,
        filtersApplied: data.filtersApplied,
        needsClarification: data.needsClarification,
        tips: data.tips
      }]);

    } catch (err: any) {
      const msg = String(err?.message || t('admin_error_message'));
      setError(msg);
      if (msg.includes('ADMIN_FETCH_401')) {
        // queue retry when auth is restored
        setPendingRetryMessage(userMessage);
      }
      setChatHistory(prev => [...prev, {
        role: 'system',
        content: msg.includes('ADMIN_FETCH_401') ? `${t('admin_session_expired')} ${t('admin_enter_key')}` : `${t('system_error')}: ${msg}`
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    const userMessage = message.trim();
    await submitInternal(userMessage, true);
  };

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    const el = chatEndRef.current;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chatHistory, loading]);

  // Listen for re-auth restoration and retry last message once
  
  if (typeof window !== 'undefined') {
    // Avoid adding duplicate listeners across renders
    // @ts-ignore
    if (!window.__admin_agent_retry_listener_added) {
      // @ts-ignore
      window.__admin_agent_retry_listener_added = true;
      window.addEventListener('admin-auth-restored', () => {
        const m = pendingRetryMessage;
        if (m) {
          setPendingRetryMessage(null);
          submitInternal(m, false);
        }
      });
    }
  }

  const exportToCSV = (results: QueryResult[]) => {
    const headers = ['Name', 'Email', 'Field of Study', 'GPA', 'Experience Count', 'Score', 'CV PDF URL', 'CV HTML URL'];
    const rows = results.map(r => [
      r.fullName,
      r.email,
      r.fieldOfStudy,
      r.gpa != null ? r.gpa.toFixed(2) : 'N/A',
      r.experienceCount?.toString() || '',
      r.score.toString(),
      r.cv_url_pdf || '',
      r.cv_url_html || ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `candidates_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const copyShortlist = (results: QueryResult[]) => {
    const text = results.map(r => {
      const pdf = r.cv_url_pdf ? `PDF: ${r.cv_url_pdf}` : 'PDF: N/A';
      const html = r.cv_url_html ? `HTML: ${r.cv_url_html}` : 'HTML: N/A';
      return `${r.fullName} - ${r.email} (${r.fieldOfStudy}, GPA: ${r.gpa != null ? r.gpa.toFixed(2) : 'N/A'}, Score: ${r.score})\n${pdf}\n${html}`;
    }).join('\n\n');
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="h-full w-full flex flex-col">
      {/* Messages list */}
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-6 pb-40">
        <div className="mx-auto w-full max-w-2xl space-y-4">
        {chatHistory.map((msg, idx) => {
          if (msg.role === 'user') {
            return (
              <div key={idx} className="flex justify-end">
                <div className="max-w-[75%] rounded-2xl bg-primary text-primary-foreground px-4 py-3 shadow-sm">
                  <div className="text-[10px] uppercase tracking-wide opacity-80 mb-1">{t('role_you')}</div>
                  <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
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
          // assistant
          return (
            <div key={idx} className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl bg-card border border-border px-4 py-3 shadow-sm w-fit">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{t('role_ai_agent')}</div>
                <p className="whitespace-pre-wrap text-sm mb-3">{msg.content}</p>

                {/* Action buttons inline inside the AI bubble */}
                {msg.results && msg.results.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Button size="sm" variant="secondary" onClick={() => exportToCSV(msg.results!)}>
                      <Download className="h-4 w-4 mr-2" /> {t('export_csv')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => copyShortlist(msg.results!)}>
                      <Copy className="h-4 w-4 mr-2" /> {t('copy_shortlist')}
                    </Button>
                  </div>
                )}

                {/* Results Table within the bubble */}
                {msg.results && msg.results.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('table_name')}</TableHead>
                          <TableHead>{t('table_email')}</TableHead>
                          <TableHead>{t('table_field')}</TableHead>
                          <TableHead>{t('gpa')}</TableHead>
                          <TableHead>{t('experience')}</TableHead>
                          <TableHead>{t('score')}</TableHead>
                          <TableHead>Why Picked</TableHead>
                          <TableHead>Download</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {msg.results.map((result) => (
                          <TableRow key={result.id}>
                            <TableCell className="font-medium">{result.fullName}</TableCell>
                            <TableCell>{result.email}</TableCell>
                            <TableCell>{result.fieldOfStudy}</TableCell>
                            <TableCell>{result.gpa != null ? result.gpa.toFixed(2) : 'N/A'}</TableCell>
                            <TableCell>{result.experienceCount || 0}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{result.score}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {result.whyPicked || '-'}
                            </TableCell>
                            <TableCell>
                              {result.cv_url_pdf ? (
                                <a
                                  href={result.cv_url_pdf}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center text-primary underline-offset-2 hover:underline"
                                >
                                  Download CV (PDF)
                                </a>
                              ) : result.cv_url_html ? (
                                <a
                                  href={result.cv_url_html}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center text-primary underline-offset-2 hover:underline"
                                >
                                  Open CV (HTML)
                                </a>
                              ) : (
                                <Button variant="outline" size="sm" disabled title="No file">Download CV</Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Project Highlights */}
                {msg.results?.some(r => r.projectHighlights?.length) && (
                  <div className="mt-4 space-y-2">
                    <h4 className="text-sm font-medium">{t('project_highlights')}</h4>
                    {msg.results!.map((result) => (
                      result.projectHighlights?.length ? (
                        <div key={result.id} className="text-xs text-muted-foreground">
                          <span className="font-medium">{result.fullName}:</span>
                          <ul className="list-disc pl-5 mt-1">
                            {result.projectHighlights.map((highlight, i) => (
                              <li key={i}>{highlight}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null
                    ))}
                  </div>
                )}

                {/* Tips for no results */}
                {msg.tips && msg.tips.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h4 className="text-sm font-medium">Try these adjustments:</h4>
                    <ul className="list-disc pl-5 text-xs text-muted-foreground">
                      {msg.tips.map((tip, i) => (
                        <li key={i}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Quick Replies for Clarification */}
                {msg.needsClarification && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setMessage(t('quick_cs_high_gpa'))}>
                      {t('quick_cs_high_gpa')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setMessage(t('quick_recent_webdev'))}>
                      {t('quick_recent_webdev')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setMessage(t('quick_with_internships'))}>
                      {t('quick_with_internships')}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading indicator bubble */}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-xl bg-card border border-border px-3 py-2 text-sm flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> {t('thinking')}
            </div>
          </div>
        )}

        {/* Error as a system bubble (in addition to per-message) */}
        {error && (
          <div className="flex justify-center">
            <div className="max-w-[85%] rounded-xl border border-destructive/40 bg-destructive/10 text-destructive px-3 py-2 text-sm">
              {error}
            </div>
          </div>
        )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Composer - fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto w-full max-w-2xl px-4 py-3">
          <div className="flex items-end gap-2">
            <div className="flex w-full items-end gap-2 rounded-2xl ring-1 ring-border bg-card shadow-sm px-3 py-2 focus-within:ring-2 focus-within:ring-primary transition">
              <Textarea
                placeholder={t('chat_placeholder')}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  const ta = e.currentTarget as HTMLTextAreaElement;
                  ta.style.height = 'auto';
                  ta.style.height = Math.min(ta.scrollHeight, 320) + 'px';
                }}
                rows={1}
                className="w-full resize-none min-h-[40px] max-h-40 rounded-xl bg-transparent border-0 focus-visible:ring-0 focus-visible:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
              <Button
                onClick={handleSubmit}
                disabled={loading || !message.trim()}
                size="icon"
                className="h-9 w-9 rounded-full bg-primary text-primary-foreground shadow hover:shadow-md transition"
                >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SendHorizontal className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
