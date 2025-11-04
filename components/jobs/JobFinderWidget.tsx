"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useLanguage } from "@/lib/language"
import { Search, X } from "lucide-react"

type JobItem = { title: string; url: string; source: string; snippet?: string; company?: string; location?: string; salary?: string; employmentType?: string; postedAt?: string }
type ChatMsg = { role: 'user' | 'assistant'; type?: 'text' | 'results'; content?: string; results?: JobItem[] }

export default function JobFinderWidget({ renderHeroButton }: { renderHeroButton?: boolean }) {
  const { lang } = useLanguage()
  const [open, setOpen] = useState(false)
  const [composer, setComposer] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [lastQuery, setLastQuery] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const sessionIdRef = useRef<string>('')

  if (!sessionIdRef.current) {
    try {
      sessionIdRef.current = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}-${Math.random().toString(16).slice(2)}`
    } catch {
      sessionIdRef.current = `session-${Date.now()}-${Math.random().toString(16).slice(2)}`
    }
  }

  const labels = useMemo(() => ({
    title: lang === "ar" ? "البحث الذكي عن وظائف" : "AI Job Finder",
    placeholder: lang === "ar" ? "اكتب طلبك بحرية: أحتاج وظيفة هندسة حاسوب..." : "Ask naturally: I need a CS engineering job...",
    cta: lang === "ar" ? "إرسال" : "Send",
    bubble: lang === "ar" ? "وظائف" : "Job Finder",
    panelSub: lang === "ar" ? "وظائف الكويت من Bayt و LinkedIn" : "Kuwait jobs from Bayt & LinkedIn",
    greet: lang === "ar" ? "مرحبًا! اكتب ما تبحث عنه: تدريب صيفي برمجة، تسويق خريجين، دوام جزئي..." : "Hi! Tell me what you're looking for: CS internships, fresh grad marketing, part-time...",
    thinking: lang === "ar" ? "جارٍ التفكير..." : "Thinking...",
  }), [lang])

  const quickFilters = useMemo(() => (
    lang === "ar"
      ? [
          "وظيفة تسويق",
          "دعم فني",
          "محاسب",
          "عن بُعد",
          "حديث التخرج",
          "تدريب",
          "دوام جزئي",
        ]
      : [
          "marketing",
          "it support",
          "software engineer",
          "remote",
          "junior",
          "fresh grad",
          "internship",
          "part-time",
        ]
  ), [lang])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    if (open) window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  useEffect(() => {
    try {
      const b = document?.body
      if (!b) return
      const prev = b.style.overflow
      if (open) b.style.overflow = "hidden"
      return () => { b.style.overflow = prev }
    } catch {}
  }, [open])

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: 'assistant', content: labels.greet }])
    }
  }, [open, messages.length, labels.greet])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0)
  }, [open])

  const doSend = async () => {
    const q = composer.trim()
    if (!q || loading) return
    setComposer("")
    setError(null)
    setMessages(prev => [...prev, { role: 'user', content: q }])
    setLoading(true)
    try {
      let effectiveQ = q
      if (lastQuery && q.split(/\s+/).length <= 6 && !/site:/.test(q)) {
        effectiveQ = `${lastQuery} ${q}`.trim()
      }

      // Create a live assistant message to stream into
      let liveIndex = -1
      setMessages(prev => {
        const next = prev.slice()
        liveIndex = next.length
        next.push({ role: 'assistant', type: 'text', content: labels.thinking })
        return next
      })

      const doStream = async (): Promise<boolean> => {
        try {
          const r = await fetch('/api/assist/job-search/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
            body: JSON.stringify({ q: effectiveQ, lang, sessionId: sessionIdRef.current }),
          })
          if (!r.ok || !r.body) return false
          const reader = r.body.getReader()
          const decoder = new TextDecoder()
          let buf = ''
          const appendToken = (t: string) => {
            setMessages(prev => {
              const next = prev.slice()
              if (next[liveIndex] && next[liveIndex].role === 'assistant') {
                next[liveIndex] = { ...next[liveIndex], type: 'text', content: (next[liveIndex].content || '') + t }
              }
              return next
            })
          }
          const setResults = (items: JobItem[]) => {
            if (!items || items.length === 0) {
              const hint = lang === 'ar'
                ? 'لم أعثر على نتائج مباشرة. جرّب تحديد الدور (مهندس برمجيات، دعم فني، محلل بيانات، مختبر برمجيات) أو أضف كلمات مثل: حديث التخرج، عن بُعد، دوام جزئي.'
                : 'No direct matches found. Try specifying a role (software engineer, IT support, data analyst, QA tester) or add: junior, remote, part-time.'
              setMessages(prev => {
                const next = prev.slice()
                if (liveIndex >= 0 && next[liveIndex]) next[liveIndex] = { role: 'assistant', type: 'text', content: hint }
                else next.push({ role: 'assistant', type: 'text', content: hint })
                return next
              })
              return
            }
            setMessages(prev => {
              const next = prev.slice()
              // Remove the "Thinking..." message when results arrive
              if (liveIndex >= 0 && next[liveIndex]) {
                next.splice(liveIndex, 1)
              }
              next.push({ role: 'assistant', type: 'results', results: items.slice(0, 10) })
              return next
            })
          }
          while (true) {
            const { value, done } = await reader.read()
            if (done) break
            buf += decoder.decode(value, { stream: true })
            let idx
            while ((idx = buf.indexOf('\n\n')) !== -1) {
              const chunk = buf.slice(0, idx)
              buf = buf.slice(idx + 2)
              const lines = chunk.split('\n')
              let eventName = 'message'
              let data = ''
              for (const ln of lines) {
                if (ln.startsWith('event:')) eventName = ln.slice(6).trim()
                else if (ln.startsWith('data:')) data += (data ? '\n' : '') + ln.slice(5).trim()
              }
              if (eventName === 'results') {
                try { const arr = JSON.parse(data) as JobItem[]; setResults(arr) } catch {}
              } else if (eventName === 'token') {
                appendToken(data)
              } else if (eventName === 'error') {
                // keep going but mark error
                setError(data || (lang === 'ar' ? 'فشل البث' : 'Streaming failed'))
              }
            }
          }
          return true
        } catch {
          return false
        }
      }

      const streamed = await doStream()
      if (!streamed) {
        // Fallback to non-streaming summary
        const r = await fetch('/api/assist/job-search', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q: effectiveQ, lang, sessionId: sessionIdRef.current })
        })
        const j = await r.json().catch(() => ({}))
        if (!r.ok || !j?.ok) {
          setError(j?.error || (lang === 'ar' ? 'فشل البحث' : 'Search failed'))
          setMessages(prev => {
            const next = prev.slice()
            if (liveIndex >= 0 && next[liveIndex]) next[liveIndex] = { role: 'assistant', type: 'text', content: lang === 'ar' ? 'عذرًا، حدث خطأ. حاول لاحقًا.' : 'Sorry, something went wrong. Please try again later.' }
            return next
          })
        } else {
          const res: JobItem[] = Array.isArray(j.results) ? j.results : []
          const ans: string | null = typeof j.answer === 'string' ? j.answer : null
          if (!res.length) {
            const hint = lang === 'ar'
              ? 'لم أعثر على نتائج مباشرة. جرّب تحديد الدور (مهندس برمجيات، دعم فني، محلل بيانات، مختبر برمجيات) أو أضف كلمات مثل: حديث التخرج، عن بُعد، دوام جزئي.'
              : 'No direct matches found. Try specifying a role (software engineer, IT support, data analyst, QA tester) or add: junior, remote, part-time.'
            setMessages(prev => {
              const next = prev.slice()
              if (liveIndex >= 0 && next[liveIndex]) next[liveIndex] = { role: 'assistant', type: 'text', content: hint }
              else next.push({ role: 'assistant', type: 'text', content: hint })
              return next
            })
          } else {
            setMessages(prev => {
              const next = prev.slice()
              // Remove the "Thinking..." message and add results
              if (liveIndex >= 0 && next[liveIndex]) {
                next.splice(liveIndex, 1)
              }
              if (ans) {
                next.push({ role: 'assistant', type: 'text', content: ans })
              }
              next.push({ role: 'assistant', type: 'results', results: res.slice(0, 10) })
              return next
            })
          }
        }
      }
      setLastQuery(effectiveQ)
    } catch {
      setError(lang === 'ar' ? 'خطأ في الشبكة' : 'Network error')
      setMessages(prev => [...prev, { role: 'assistant', content: lang === 'ar' ? 'تعذر الاتصال بالشبكة.' : 'Network error.' }])
    } finally {
      setLoading(false)
    }
  }

  const appendQuickFilter = (value: string) => {
    setComposer(prev => {
      const base = prev.trim()
      if (!base) return value
      return `${base} ${value}`
    })
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const Panel = (
    <div role="dialog" aria-modal className="fixed inset-0 z-[99999]">
      <div className="hidden md:block absolute inset-0 bg-black/20" onClick={() => setOpen(false)} />
      <div className="absolute bottom-0 left-0 right-0 h-[92%] rounded-t-2xl border-[3px] border-black bg-white p-3 md:bottom-6 md:right-6 md:left-auto md:h-[700px] md:w-[460px] md:rounded-2xl md:shadow-[10px_10px_0_#111]">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-base font-extrabold">{labels.title}</div>
            <div className="text-xs text-neutral-600">{labels.panelSub}</div>
          </div>
          <Button size="sm" variant="outline" className="rounded-xl border-[2px] border-black" onClick={() => setOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="mt-3 h-[1px] bg-neutral-200" />
        {quickFilters.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {quickFilters.map((chip) => (
              <button
                key={chip}
                type="button"
                className="rounded-2xl border-[2px] border-black bg-[#e0f2ff] px-3 py-1 text-xs font-semibold text-neutral-700 shadow-[3px_3px_0_#111] transition-transform hover:-translate-y-0.5"
                onClick={() => appendQuickFilter(chip)}
                disabled={loading}
              >
                {chip}
              </button>
            ))}
          </div>
        ) : null}
        <div ref={listRef} className="mt-3 overflow-y-auto pr-1" style={{ maxHeight: "72%" }}>
          <div className="flex flex-col gap-2">
            {messages.map((m, idx) => (
              m.type === 'results' && m.results ? (
                <div key={idx} className="self-start w-full space-y-2">
                  {m.results.map((r, i) => (
                    <a key={i} href={r.url} target="_blank" rel="noreferrer" className={`block rounded-xl border-[2px] p-3 shadow-[4px_4px_0_#111] hover:shadow-[6px_6px_0_#111] hover:-translate-y-0.5 transition-all ${(r as any).isInternal ? 'border-green-500 bg-green-50' : 'border-black bg-white'}`}>
                      {r.company ? (
                        <div className="flex items-start gap-2 mb-1">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <div className="font-bold text-base">{r.company}</div>
                              {(r as any).isInternal ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500 text-white font-bold uppercase">Featured</span> : null}
                            </div>
                            {r.location ? <div className="text-xs text-neutral-500 mt-0.5">{r.location}</div> : null}
                          </div>
                          {!(r as any).isInternal ? <div className="text-[10px] uppercase tracking-wide text-neutral-400 font-semibold">{r.source}</div> : null}
                        </div>
                      ) : null}
                      <div className={r.company ? "text-sm font-semibold text-neutral-700" : "text-base font-bold"}>{r.title}</div>
                      {r.snippet ? <div className="text-xs text-neutral-600 mt-1.5 line-clamp-2">{r.snippet}</div> : null}
                      {(r.salary || r.employmentType || r.postedAt) ? (
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-neutral-600">
                          {r.salary ? <span className="rounded-lg border border-neutral-300 bg-neutral-100 px-2 py-0.5">{r.salary}</span> : null}
                          {r.employmentType ? <span className="rounded-lg border border-neutral-300 bg-neutral-100 px-2 py-0.5">{r.employmentType}</span> : null}
                          {r.postedAt ? <span className="rounded-lg border border-neutral-300 bg-neutral-100 px-2 py-0.5">{r.postedAt}</span> : null}
                        </div>
                      ) : null}
                      {!r.company ? <div className="text-[10px] uppercase tracking-wide text-neutral-400 font-semibold mt-2">{r.source}</div> : null}
                    </a>
                  ))}
                </div>
              ) : (
                <div key={idx} className={m.role === 'user' ? 'self-end max-w-[85%] rounded-2xl border-[3px] border-black bg-[#ffd6a5] px-3 py-2 shadow-[4px_4px_0_#111] whitespace-pre-wrap' : 'self-start max-w-[95%] rounded-2xl border-[3px] border-black bg-white px-3 py-2 shadow-[4px_4px_0_#111] whitespace-pre-wrap'}>
                  {m.content}
                </div>
              )
            ))}
            {error ? <div className="text-sm text-red-600">{error}</div> : null}
          </div>
        </div>
        <div className="absolute left-0 right-0 bottom-0 p-3 pt-2 md:static md:p-0 md:mt-3">
          <div className="flex gap-2 items-end">
            <Textarea
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              placeholder={labels.placeholder}
              className="rounded-2xl border-[2px] border-black min-h-[56px] max-h-[160px]"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend() } }}
              ref={inputRef}
            />
            <Button onClick={doSend} disabled={loading} className="rounded-2xl border-[2px] border-black bg-[#bde0fe] text-black px-5 h-12">
              {loading ? (lang === "ar" ? "جارٍ..." : "...") : labels.cta}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {renderHeroButton ? (
        <Button size="lg" onClick={() => setOpen(true)} className="rounded-2xl px-6 border-2 border-black bg-[#bde0fe] text-black shadow-[3px_3px_0_#111] hover:-translate-y-0.5 hover:bg-[#bde0fe]/80 transition-transform">
          {labels.title}
        </Button>
      ) : null}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 md:bottom-6 md:right-6 md:left-auto md:translate-x-0 z-[9998]">
        <button
          type="button"
          className="rounded-2xl border-[3px] border-black bg-white px-4 py-2 shadow-[6px_6px_0_#111] flex items-center gap-2"
          aria-label={labels.title}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true) }}
        >
          <Search className="h-4 w-4" />
          <span className="text-sm font-semibold">{labels.bubble}</span>
        </button>
      </div>
      {open ? Panel : null}
    </>
  )
}
