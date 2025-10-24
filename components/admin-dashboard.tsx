'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Search, Filter, Eye, EyeOff, Users, RefreshCw } from 'lucide-react';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { redactEmail, redactPhone, redactName } from '@/lib/redact';
import { adminFetch } from '@/lib/admin-fetch';
import { useLanguage } from '@/lib/language';
import TelemetryToday from '@/components/admin/TelemetryToday';
import { AdminAIAgentPanel } from '@/components/admin/AdminAIAgentPanel';
import { AdminAIAgentPanelV2 } from '@/components/admin/AdminAIAgentPanelV2';
import ImportTab from '@/components/admin/ImportTab';

interface Student {
  id: string | number;
  full_name: string;
  email: string;
  phone: string;
  field_of_study: string;
  area_of_interest: string;
  cv_type: string;
  cv_url: string;
  has_cv?: boolean;
  suggested_vacancies?: string | null;
  suggested_vacancies_list?: string[];
  submitted_at: string;
  gpa?: number | string | null;
  cv_parse_status?: 'queued' | 'processing' | 'done' | 'error' | string | null;
  knet_profile?: {
    degreeBucket?: string;
    yearsOfExperienceBucket?: string;
    areaOfInterest?: string;
  } | null;
  cv_json?: any;
  // Admin decision fields from API (prefill)
  decision_status?: 'pending' | 'shortlisted' | 'rejected' | 'interviewed' | 'hired' | string;
  decision_reason?: string | null;
  decision_date?: string | null; // ISO string from DB
}

// Guard hook to normalize empty string to undefined for Select components
function useSelectSafe<T extends string | undefined>(v: T) {
  return v && v.length ? v : undefined;
}

export default function AdminDashboard({ orgSlug: orgProp }: { orgSlug?: string } = {}) {
  const { t, lang } = useLanguage();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [fieldFilter, setFieldFilter] = useState<string | undefined>(undefined);
  const [interestFilter, setInterestFilter] = useState<string | undefined>(undefined);
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [vacancyFilter, setVacancyFilter] = useState('');
  const [degreeFilter, setDegreeFilter] = useState<string | undefined>(undefined);
  const [yoeFilter, setYoeFilter] = useState<string | undefined>(undefined);
  const [knetAreaFilter, setKnetAreaFilter] = useState<string | undefined>(undefined);
  const [showPII, setShowPII] = useState(false);
  const [revealedRows, setRevealedRows] = useState<Set<string>>(new Set());
  const FILTERS_STORAGE_KEY = 'admin_students_filters_v1';
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | number | null>(null);
  const [parsingId, setParsingId] = useState<string | number | null>(null);
  const [adminToken, setAdminToken] = useState<string>('');
  // Decision state per candidate (optimistic UI)
  const [decisionById, setDecisionById] = useState<Record<string, { status: string; reason?: string; updatedAt?: string; saving?: boolean }>>({});

  // Audit tab state
  const [auditEvents, setAuditEvents] = useState<Array<{
    created_at: string;
    action: string;
    candidate_id?: string | null;
    candidate_name?: string | null;
    admin_email?: string | null;
    ip?: string | null;
    user_agent?: string | null;
  }>>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditOffset, setAuditOffset] = useState(0)
  const [auditTotal, setAuditTotal] = useState(0)
  const auditLimit = 50
  const [auditRange, setAuditRange] = useState<'7'|'30'|'90'|'custom'>('7')
  const [auditFrom, setAuditFrom] = useState<string>('')
  const [auditTo, setAuditTo] = useState<string>('')
  const [auditAction, setAuditAction] = useState<string>('')
  const [auditAdminEmail, setAuditAdminEmail] = useState<string>('')
  const [auditIP, setAuditIP] = useState<string>('')
  const [auditUA, setAuditUA] = useState<string>('')
  const [auditCandidate, setAuditCandidate] = useState<string>('')
  const [auditSeries7d, setAuditSeries7d] = useState<Array<{ day: string; count: number }>>([])
  const [auditMyStats, setAuditMyStats] = useState<{csv:number; presign:number; logins:number}>({csv:0,presign:0,logins:0})

  useEffect(() => {
    fetchStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgProp]);

  // Refetch after auth is restored (e.g., inline login succeeds)
  useEffect(() => {
    const onRestored = () => { fetchStudents(); };
    if (typeof window !== 'undefined') {
      window.addEventListener('admin-auth-restored', onRestored as any);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('admin-auth-restored', onRestored as any);
      }
    };
  }, []);

  // Load Audit helper
  const loadAudit = async () => {
    const org = resolveOrg();
    if (!org) return;
    setAuditLoading(true)
    try {
      const sp = new URLSearchParams();
      if (auditRange !== 'custom') {
        const days = parseInt(auditRange, 10);
        const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        sp.set('from', from)
      } else {
        if (auditFrom) sp.set('from', new Date(auditFrom).toISOString())
        if (auditTo) sp.set('to', new Date(auditTo).toISOString())
      }
      if (auditAction) sp.set('action', auditAction)
      if (auditAdminEmail) sp.set('admin_email', auditAdminEmail)
      if (auditIP) sp.set('ip', auditIP)
      if (auditUA) sp.set('user_agent', auditUA)
      if (auditCandidate) sp.set('candidate', auditCandidate)
      sp.set('limit', String(auditLimit))
      sp.set('offset', String(auditOffset))
      const data = await adminFetch(`/api/${org}/admin/audit?${sp.toString()}`)
      setAuditEvents(Array.isArray(data?.events) ? data.events : [])
      setAuditTotal(Number(data?.total || 0))
      // Fetch my stats in parallel (best effort)
      try {
        const myEmail = (typeof window!=='undefined' && (localStorage.getItem('admin_email')||sessionStorage.getItem('admin_email')||''))||''
        const headers: Record<string,string> = {}
        if (myEmail) headers['x-admin-email'] = myEmail
        const stats = await fetch(`/api/${org}/admin/audit/stats`, { headers })
          .then(r=>r.ok?r.json():Promise.resolve({}))
        setAuditMyStats({
          csv: Number(stats?.my?.export_candidates_csv || 0),
          presign: Number(stats?.my?.cv_presign || 0),
          logins: Number(stats?.my?.admin_login_success || 0),
        })
        setAuditSeries7d(Array.isArray(stats?.series7d) ? stats.series7d : [])
      } catch {}
    } catch (e) {
      toast.error('Failed to load audit events')
    } finally {
      setAuditLoading(false)
    }
  }

  // Auto-load audit when filters change (reset offset or fetch if already on page 1)
  useEffect(() => {
    if (auditOffset !== 0) {
      setAuditOffset(0)
    } else {
      loadAudit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditRange, auditFrom, auditTo, auditAction, auditAdminEmail, auditIP, auditUA, auditCandidate])

  // Auto-load when page changes
  useEffect(() => {
    loadAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditOffset])

  // Keep admin token in state for building PDF hrefs
  useEffect(() => {
    const update = () => {
      try {
        const tok = (localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token') || '').trim();
        setAdminToken(tok);
      } catch {}
    };
    update();
    if (typeof window !== 'undefined') {
      window.addEventListener('admin-auth-restored', update as any);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('admin-auth-restored', update as any);
      }
    };
  }, []);

  useEffect(() => {
    filterStudents();
  }, [students, searchTerm, fieldFilter, interestFilter, typeFilter, vacancyFilter, degreeFilter, yoeFilter, knetAreaFilter]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(FILTERS_STORAGE_KEY) || '';
      if (raw) {
        const s = JSON.parse(raw);
        setSearchTerm(typeof s.searchTerm === 'string' ? s.searchTerm : '');
        setFieldFilter(s.fieldFilter || undefined);
        setInterestFilter(s.interestFilter || undefined);
        setTypeFilter(s.typeFilter || undefined);
        setVacancyFilter(typeof s.vacancyFilter === 'string' ? s.vacancyFilter : '');
        setDegreeFilter(s.degreeFilter || undefined);
        setYoeFilter(s.yoeFilter || undefined);
        setKnetAreaFilter(s.knetAreaFilter || undefined);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const s = {
        searchTerm,
        fieldFilter,
        interestFilter,
        typeFilter,
        vacancyFilter,
        degreeFilter,
        yoeFilter,
        knetAreaFilter,
      };
      window.localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(s));
    } catch {}
  }, [searchTerm, fieldFilter, interestFilter, typeFilter, vacancyFilter, degreeFilter, yoeFilter, knetAreaFilter]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = (target?.tagName || '').toLowerCase();
      const editing = tag === 'input' || tag === 'textarea' || (!!target && (target as any).isContentEditable);
      if (editing) return;
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        fetchStudents();
        try { toast.success('Refreshing candidates...'); } catch {}
      } else if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const resolveOrg = (): string | null => {
    // Priority: prop > URL (?org=) > sessionStorage('current_org') > path prefix
    if (orgProp && orgProp.trim()) return orgProp.trim();
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const qp = sp.get('org');
      if (qp && qp.trim()) return qp.trim();
      const ss = window.sessionStorage?.getItem('current_org');
      if (ss && ss.trim()) return ss.trim();
      // Try parsing /{org}/admin path
      const m = window.location.pathname.match(/^\/(.+?)\/admin/);
      if (m && m[1]) return m[1];
    }
    return null;
  };

  const fetchStudents = async () => {
    try {
      const org = resolveOrg();
      if (!org) throw new Error('ADMIN_ORG_MISSING');
      const data = await adminFetch(`/api/${org}/admin/students`);
      const rows: Student[] = data.students || []
      setStudents(rows);
      // Prefill decisions for optimistic UI
      try {
        const map: Record<string, { status: string; reason?: string; updatedAt?: string; saving?: boolean }> = {}
        for (const r of rows) {
          const key = String(r.id)
          const status = (r.decision_status || 'pending').toString()
          const reason = (r.decision_reason || '')
          const updatedAt = r.decision_date ? new Date(r.decision_date).toISOString() : undefined
          map[key] = { status, reason, updatedAt }
        }
        setDecisionById(map)
      } catch {}
    } catch (error) {
      console.error('Error fetching students:', error);
      // If auth error, trigger inline login modal and wait for re-auth
      if (error instanceof Error && error.message.includes('ADMIN_FETCH_401') && typeof window !== 'undefined') {
        try { window.dispatchEvent(new CustomEvent('admin-auth-required')); } catch {}
      } else if (error instanceof Error && error.message.includes('ADMIN_ORG_MISSING')) {
        // Surface a friendly error
        setStudents([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const filterStudents = () => {
    let filtered = students;

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(student => 
        (student.full_name ?? '').toLowerCase().includes(q) ||
        (student.email ?? '').toLowerCase().includes(q)
      );
    }

    if (fieldFilter) {
      filtered = filtered.filter(student => student.field_of_study === fieldFilter);
    }

    if (interestFilter) {
      filtered = filtered.filter(student => student.area_of_interest === interestFilter);
    }

    if (typeFilter) {
      filtered = filtered.filter(student => student.cv_type === typeFilter);
    }

    if (vacancyFilter) {
      filtered = filtered.filter(student => {
        if (!student.suggested_vacancies) return false;
        return student.suggested_vacancies.toLowerCase().includes(vacancyFilter.toLowerCase()) ||
               (student.suggested_vacancies_list && student.suggested_vacancies_list.some(v => 
                 v.toLowerCase().includes(vacancyFilter.toLowerCase())
               ));
      });
    }

    if (degreeFilter) {
      filtered = filtered.filter(s => (s.knet_profile?.degreeBucket || '') === degreeFilter)
    }
    if (yoeFilter) {
      filtered = filtered.filter(s => (s.knet_profile?.yearsOfExperienceBucket || '') === yoeFilter)
    }
    if (knetAreaFilter) {
      filtered = filtered.filter(s => (s.knet_profile?.areaOfInterest || '') === knetAreaFilter)
    }

    setFilteredStudents(filtered);
  };

  const downloadCV = (url: string, name: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name}_CV`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const presignAndDownload = async (student: Student) => {
    if (!student?.id) return;
    const org = resolveOrg();
    if (!org) return;
    try {
      setDownloadingId(student.id);
      const headers: Record<string,string> = { 'Content-Type': 'application/json' }
      if (adminToken) headers['x-admin-key'] = adminToken
      const res = await fetch(`/api/${org}/admin/cv/presign`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ candidateId: String(student.id) })
      });
      if (!res.ok) throw new Error(`HTTP_${res.status}`);
      const data = await res.json();
      if (!data?.url) throw new Error('NO_URL');
      downloadCV(data.url, student.full_name);
    } catch (e: any) {
      toast.error('CV not available or presign failed.');
    } finally {
      setDownloadingId(null);
    }
  };

  const parseCV = async (student: Student) => {
    if (!student?.id) return;
    const org = resolveOrg();
    if (!org) return;
    try {
      setParsingId(student.id);
      toast.loading('Parsing CV...', { id: 'parse-cv' });
      
      const headers: Record<string,string> = {}
      const internalToken = process.env.NEXT_PUBLIC_INTERNAL_API_TOKEN || '';
      if (internalToken) headers['x-internal-token'] = internalToken;
      
      const res = await fetch(`/api/${org}/admin/cv/parse/${student.id}`, {
        method: 'POST',
        headers
      });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP_${res.status}`);
      }
      
      const data = await res.json();
      toast.success(`CV parsed successfully! ${data.word_count || 0} words extracted.`, { id: 'parse-cv' });
      
      // Refresh the student list to show updated status
      await fetchStudents();
    } catch (e: any) {
      toast.error(`Parse failed: ${e.message}`, { id: 'parse-cv' });
    } finally {
      setParsingId(null);
    }
  };

  const pdfHref = (id: string | number) => {
    const idStr = String(id)
    const params = new URLSearchParams();
    if (adminToken) params.set('token', adminToken);
    if (lang) params.set('lang', lang);
    const qs = params.toString();
    // UUID v4-ish detection (allowing any RFC4122 style UUID)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idStr)
    const org = resolveOrg()
    if (isUUID && org) {
      return `/api/${org}/admin/cv/pdf/${idStr}${qs ? `?${qs}` : ''}`
    }
    // Legacy students route (numeric IDs)
    if (typeof id !== 'number' && isNaN(Number(idStr))) return ''
    return `/api/cv/${idStr}/pdf${qs ? `?${qs}` : ''}`
  };

  // Helpers
  const formatGPA = (g: any): string => {
    if (g === null || g === undefined || g === '') return 'N/A';
    const n = Number(g);
    return Number.isFinite(n) ? n.toFixed(2) : 'N/A';
  };

  const statusVariant = (s?: string | null) => {
    switch ((s || '').toLowerCase()) {
      case 'queued':
        return 'outline' as const;
      case 'processing':
        return 'secondary' as const;
      case 'done':
        return 'default' as const;
      case 'error':
        return 'destructive' as const;
      default:
        return 'outline' as const;
    }
  };

  const toggleRowReveal = (studentId: string | number) => {
    const key = String(studentId)
    const newRevealed = new Set(revealedRows);
    if (newRevealed.has(key)) {
      newRevealed.delete(key);
    } else {
      newRevealed.add(key);
    }
    setRevealedRows(newRevealed);
  };

  const toggleGlobalPII = () => {
    setShowPII(!showPII);
    if (showPII) {
      setRevealedRows(new Set());
    }
  };

  const isRowRevealed = (studentId: string | number) => showPII || revealedRows.has(String(studentId));

  const getDisplayValue = (value: string, type: 'name' | 'email' | 'phone', studentId: string | number) => {
    if (isRowRevealed(studentId)) {
      return value;
    }
    
    switch (type) {
      case 'name':
        return redactName(value);
      case 'email':
        return redactEmail(value);
      case 'phone':
        return redactPhone(value);
      default:
        return value;
    }
  };

  const uniqueFields = [...new Set(
    students.map(s => s.field_of_study).filter((v): v is string => !!v && v.toString().trim() !== '')
  )];
  const uniqueInterests = [...new Set(
    students.map(s => s.area_of_interest).filter((v): v is string => !!v && v.toString().trim() !== '')
  )];
  const uniqueVacancies = [...new Set(students.flatMap(s => s.suggested_vacancies_list || []))];
  const uniqueDegrees = [...new Set(students.map(s => s.knet_profile?.degreeBucket).filter((v): v is string => !!v && v.trim() !== ''))]
  const uniqueYoE = [...new Set(students.map(s => s.knet_profile?.yearsOfExperienceBucket).filter((v): v is string => !!v && v.trim() !== ''))]
  const uniqueKnetAreas = [...new Set(students.map(s => s.knet_profile?.areaOfInterest).filter((v): v is string => !!v && v.trim() !== ''))]

  const exportToCSV = () => {
    // Build server-side export URL with current filters (HR export)
    const org = resolveOrg();
    if (!org) return;
    const sp = new URLSearchParams();
    if (degreeFilter) sp.set('degree', degreeFilter);
    if (yoeFilter) sp.set('yoe', yoeFilter);
    const area = knetAreaFilter || interestFilter
    if (area) sp.set('area', area)
    if (typeFilter) sp.set('cvType', typeFilter);
    // parseStatus filter not yet exposed in UI
    const url = `/api/${org}/admin/candidates/export${sp.toString() ? `?${sp.toString()}` : ''}`
    // Trigger browser download
    window.location.href = url
  };

  // Mount point for top header tabs (must be declared before any early return)
  const [tabsSlot, setTabsSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setTabsSlot(document.getElementById('admin-tabs-slot') as HTMLElement | null);
  }, []);

  const TabsListContent = (
    <TabsList className="flex items-center gap-2 rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111] px-2 py-2">
      <TabsTrigger value="students" className="flex items-center gap-2 rounded-xl border-[3px] border-transparent data-[state=active]:border-black data-[state=active]:bg-white data-[state=active]:shadow-[4px_4px_0_#111]">
        <Users className="h-4 w-4" />
        <span className="hidden sm:inline">{t('student_cvs')}</span>
        <span className="sm:hidden">{t('student_cvs')}</span>
      </TabsTrigger>
      <TabsTrigger value="ai-agent" className="flex items-center gap-2 rounded-xl border-[3px] border-transparent data-[state=active]:border-black data-[state=active]:bg-white data-[state=active]:shadow-[4px_4px_0_#111]">
        {t('ai_agent')}
      </TabsTrigger>
      <TabsTrigger value="audit" className="flex items-center gap-2 rounded-xl border-[3px] border-transparent data-[state=active]:border-black data-[state=active]:bg-white data-[state=active]:shadow-[4px_4px_0_#111]">
        Audit
      </TabsTrigger>
      <TabsTrigger value="import" className="flex items-center gap-2 rounded-xl border-[3px] border-transparent data-[state=active]:border-black data-[state=active]:bg-white data-[state=active]:shadow-[4px_4px_0_#111]">
        📧 Import
      </TabsTrigger>
    </TabsList>
  );

  // Build last 7 days series with zero-fill
  const series7 = (() => {
    const map = new Map<string, number>(auditSeries7d.map(s => [s.day, Number(s.count || 0)]))
    const out: Array<{ day: string; count: number }> = []
    const today = new Date(); today.setHours(0,0,0,0)
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i)
      const day = d.toISOString().slice(0,10)
      out.push({ day, count: map.get(day) || 0 })
    }
    return out
  })()
  const maxSeriesCount = Math.max(1, ...series7.map(s => s.count))

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">{t('admin_loading')}</div>
      </div>
    );
  }

  return (
    <Tabs defaultValue="students" className="flex flex-col min-h-screen w-full">
      {/* Render Tabs in header if slot exists, else inline fallback */}
      {tabsSlot ? createPortal(TabsListContent, tabsSlot) : (
        <div className="mx-auto max-w-7xl w-full px-4 py-3">{TabsListContent}</div>
      )}

      {/* Students Tab */}
      <TabsContent value="students" className="flex-1">
        <div className="mx-auto max-w-7xl w-full px-4 space-y-6 pb-8">
      {/* Filters */}
      <Card className="mb-6 rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {t('filters')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <Input
                placeholder={t('search_placeholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
                ref={searchInputRef}
              />
            </div>
            <div>
              <Select value={useSelectSafe(fieldFilter)} onValueChange={(v) => setFieldFilter(v && v !== '__ALL__' ? v : undefined)}>
                <SelectTrigger data-testid="filter-field-trigger">
                  <SelectValue placeholder={t('label_field_of_study')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ALL__">{t('all_fields')}</SelectItem>
                  {uniqueFields.filter(Boolean).map(field => (
                    <SelectItem key={field} value={field}>{field}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={useSelectSafe(interestFilter)} onValueChange={(v) => setInterestFilter(v && v !== '__ALL__' ? v : undefined)}>
                <SelectTrigger data-testid="filter-interest-trigger">
                  <SelectValue placeholder={t('label_area_of_interest')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ALL__">{t('all_interests')}</SelectItem>
                  {uniqueInterests.filter(Boolean).map(interest => (
                    <SelectItem key={interest} value={interest}>{interest}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={useSelectSafe(typeFilter)} onValueChange={(v) => setTypeFilter(v && v !== '__ALL__' ? v : undefined)}>
                <SelectTrigger data-testid="filter-type-trigger">
                  <SelectValue placeholder={t('label_cv_type')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ALL__">{t('all_types')}</SelectItem>
                  <SelectItem value="uploaded">{t('uploaded')}</SelectItem>
                  <SelectItem value="ai">{t('ai_generated')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Input
                placeholder={t('filter_by_vacancy')}
                value={vacancyFilter}
                onChange={(e) => setVacancyFilter(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <Select value={useSelectSafe(degreeFilter)} onValueChange={(v) => setDegreeFilter(v && v !== '__ALL__' ? v : undefined)}>
                <SelectTrigger>
                  <SelectValue placeholder="Degree" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ALL__">All Degrees</SelectItem>
                  {uniqueDegrees.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={useSelectSafe(yoeFilter)} onValueChange={(v) => setYoeFilter(v && v !== '__ALL__' ? v : undefined)}>
                <SelectTrigger>
                  <SelectValue placeholder="YoE" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ALL__">All YoE</SelectItem>
                  {uniqueYoE.map(y => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={useSelectSafe(knetAreaFilter)} onValueChange={(v) => setKnetAreaFilter(v && v !== '__ALL__' ? v : undefined)}>
                <SelectTrigger>
                  <SelectValue placeholder="Area" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ALL__">All Areas</SelectItem>
                  {uniqueKnetAreas.map(a => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm('');
                  setFieldFilter(undefined);
                  setInterestFilter(undefined);
                  setTypeFilter(undefined);
                  setVacancyFilter('');
                  setDegreeFilter(undefined);
                  setYoeFilter(undefined);
                  setKnetAreaFilter(undefined);
                  try { if (typeof window !== 'undefined') window.localStorage.removeItem(FILTERS_STORAGE_KEY) } catch {}
                }}
                className="w-full"
              >
                {t('clear_filters')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export and Privacy Controls */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={exportToCSV} variant="outline" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            {t('export_csv')} ({filteredStudents.length})
          </Button>
          <Button 
            onClick={() => {
              fetchStudents();
              toast.success('Refreshing candidates...');
            }} 
            variant="outline" 
            size="sm"
            className="flex items-center gap-2"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            {t('privacy_mode')}: {showPII ? t('pii_visible') : t('pii_masked')}
          </div>
          <Button
            onClick={toggleGlobalPII}
            variant={showPII ? "destructive" : "default"}
            size="sm"
            className="flex items-center gap-2"
            data-testid="toggle-pii-button"
          >
            {showPII ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showPII ? t('hide_pii') : t('show_pii')}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
        <Card className="rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111]">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{students.length}</div>
            <p className="text-xs text-muted-foreground">{t('total_submissions')}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111]">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{students.filter(s => new Date(s.submitted_at).getTime() >= (Date.now() - 7*24*60*60*1000)).length}</div>
            <p className="text-xs text-muted-foreground">{t('new_this_week')}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111]">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{students.filter(s => s.cv_type === 'uploaded' && new Date(s.submitted_at).getTime() >= (Date.now() - 7*24*60*60*1000)).length}</div>
            <p className="text-xs text-muted-foreground">{t('recent_uploads_7d')}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111]">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{students.filter(s => s.cv_type === 'ai').length}</div>
            <p className="text-xs text-muted-foreground">{t('ai_generated_cvs')}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111]">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{students.filter(s => String(s.cv_parse_status||'').toLowerCase() === 'done' && (new Date(s.submitted_at).setHours(0,0,0,0) === new Date().setHours(0,0,0,0))).length}</div>
            <p className="text-xs text-muted-foreground">{t('parsed_today')}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111]">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">{t('inbox_unread')}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111]">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{filteredStudents.length}</div>
            <p className="text-xs text-muted-foreground">{t('filtered_results')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Events Today Telemetry */}
      <Card className="mb-6 rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111]">
        <CardHeader>
          <CardTitle>{t('events_today')}</CardTitle>
        </CardHeader>
        <CardContent>
          <TelemetryToday />
        </CardContent>
      </Card>

      {/* Students Table */}
      <Card className="rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111]">
        <CardHeader>
          <CardTitle>{t('student_submissions')}</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredStudents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('no_students_found')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left">{t('table_name')}</TableHead>
                  <TableHead className="text-left">{t('table_email')}</TableHead>
                  <TableHead className="text-left">{t('table_phone')}</TableHead>
                  <TableHead className="text-left">{t('table_field')}</TableHead>
                  <TableHead className="text-left">{t('table_interest')}</TableHead>
                  <TableHead className="text-left">Degree Bucket</TableHead>
                  <TableHead className="text-left">YoE Bucket</TableHead>
                  <TableHead className="text-left">Area</TableHead>
                  <TableHead className="text-left">GPA</TableHead>
                  <TableHead className="text-left">{t('table_suggested_vacancies')}</TableHead>
                  <TableHead className="text-left">{t('table_cv_type')}</TableHead>
                  <TableHead className="text-left">{t('table_submitted')}</TableHead>
                  <TableHead className="text-left">Parse</TableHead>
                  <TableHead className="text-left">Decision</TableHead>
                  <TableHead className="text-left">{t('table_actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium" data-testid={`student-name-${student.id}`}>
                      {getDisplayValue(student.full_name, 'name', student.id)}
                    </TableCell>
                    <TableCell data-testid={`student-email-${student.id}`}>
                      {getDisplayValue(student.email, 'email', student.id)}
                    </TableCell>
                    <TableCell data-testid={`student-phone-${student.id}`}>
                      {getDisplayValue(student.phone, 'phone', student.id)}
                    </TableCell>
                    <TableCell>{student.field_of_study}</TableCell>
                    <TableCell>{student.area_of_interest}</TableCell>
                    <TableCell
                      title={(function () {
                        const stored = student.knet_profile?.degreeBucket || '';
                        const input = (student as any)?.cv_json?.knetProfile?.degreeBucket || '';
                        if (!stored && !input) return '';
                        if (!input) return `Stored: ${stored}`;
                        if (stored === input) return `Stored: ${stored} • Input: ${input}`;
                        return `Stored: ${stored} • Auto-normalized from: ${input}`;
                      })()}
                    >
                      {student.knet_profile?.degreeBucket || '—'}
                    </TableCell>
                    <TableCell
                      title={(function () {
                        const stored = student.knet_profile?.yearsOfExperienceBucket || '';
                        const input = (student as any)?.cv_json?.knetProfile?.yearsOfExperienceBucket || '';
                        if (!stored && !input) return '';
                        if (!input) return `Stored: ${stored}`;
                        if (stored === input) return `Stored: ${stored} • Input: ${input}`;
                        return `Stored: ${stored} • Auto-normalized from: ${input}`;
                      })()}
                    >
                      {student.knet_profile?.yearsOfExperienceBucket || '—'}
                    </TableCell>
                    <TableCell
                      title={(function () {
                        const stored = student.knet_profile?.areaOfInterest || '';
                        const input = (student as any)?.cv_json?.knetProfile?.areaOfInterest || '';
                        if (!stored && !input) return '';
                        if (!input) return `Stored: ${stored}`;
                        if (stored === input) return `Stored: ${stored} • Input: ${input}`;
                        return `Stored: ${stored} • Auto-normalized from: ${input}`;
                      })()}
                    >
                      {student.knet_profile?.areaOfInterest || '—'}
                    </TableCell>
                    <TableCell>{formatGPA((student as any).gpa)}</TableCell>
                    <TableCell>
                      {(student.suggested_vacancies || (student.suggested_vacancies_list && student.suggested_vacancies_list.length)) ? (
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-1">
                            {(student.suggested_vacancies_list && student.suggested_vacancies_list.length
                              ? student.suggested_vacancies_list
                              : (student.suggested_vacancies || '').split('/')
                            ).filter(Boolean).map((item) => (
                              <span
                                key={item}
                                className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground/80"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                          {student.suggested_vacancies ? (
                            <div className="text-xs text-muted-foreground">
                              <span className="font-medium">{t('raw_label')}</span> {student.suggested_vacancies}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={student.cv_type === 'ai' ? 'secondary' : 'outline'}>
                        {student.cv_type === 'ai' ? t('ai_generated') : t('uploaded')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(student.submitted_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant={
                          (student as any).cv_parse_status === 'completed' ? 'outline' :
                          (student as any).cv_parse_status === 'failed' ? 'destructive' :
                          (student as any).cv_parse_status === 'processing' ? 'secondary' :
                          'default'
                        }
                        onClick={() => parseCV(student)}
                        disabled={parsingId === student.id || (student as any).cv_parse_status === 'processing'}
                        className="text-xs h-7"
                      >
                        {parsingId === student.id ? (
                          <span className="flex items-center gap-1">
                            <span className="animate-spin">⏳</span> Parsing...
                          </span>
                        ) : (
                          (student as any).cv_parse_status ? String((student as any).cv_parse_status).toUpperCase() : 'PARSE'
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Select
                          value={(decisionById[String(student.id)]?.status || 'pending') as any}
                          onValueChange={(v) => {
                            const key = String(student.id)
                            setDecisionById(prev => ({ ...prev, [key]: { ...(prev[key] || {}), status: v } }))
                          }}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Pending" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="shortlisted">Shortlisted</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                            <SelectItem value="interviewed">Interviewed</SelectItem>
                            <SelectItem value="hired">Hired</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="Reason (optional)"
                          className="w-[180px]"
                          value={decisionById[String(student.id)]?.reason || ''}
                          onChange={(e) => {
                            const key = String(student.id)
                            const val = e.target.value
                            setDecisionById(prev => ({ ...prev, [key]: { ...(prev[key] || { status: 'pending' }), reason: val } }))
                          }}
                        />
                        <Button
                          size="sm"
                          variant="default"
                          disabled={!!decisionById[String(student.id)]?.saving}
                          onClick={async () => {
                            const org = resolveOrg();
                            if (!org) { toast.error('Organization not resolved'); return; }
                            const key = String(student.id)
                            const current = decisionById[key] || { status: 'pending', reason: '' }
                            const prevSnapshot = { ...current }
                            setDecisionById(prev => ({ ...prev, [key]: { ...current, saving: true } }))
                            try {
                              const res = await adminFetch(`/api/${org}/admin/candidates/${key}/decision`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: current.status, reason: current.reason || '' })
                              })
                              const updated = {
                                status: (res?.decision?.status || current.status),
                                reason: (res?.decision?.reason || current.reason || ''),
                                updatedAt: (res?.decision?.decision_date_utc || new Date().toISOString()),
                                saving: false,
                              }
                              setDecisionById(prev => ({ ...prev, [key]: updated }))
                              toast.success('Decision saved')
                            } catch (e) {
                              // revert
                              setDecisionById(prev => ({ ...prev, [key]: { ...prevSnapshot, saving: false } }))
                              toast.error('Failed to save decision')
                            }
                          }}
                        >
                          Save
                        </Button>
                      </div>
                      {decisionById[String(student.id)]?.updatedAt ? (
                        <div className="text-[10px] text-muted-foreground mt-1">
                          Updated {new Date(decisionById[String(student.id)]!.updatedAt as string).toLocaleString()}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {
                          (() => {
                            const href = pdfHref(student.id);
                            if (!href) return (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled
                                title="No PDF available"
                                className="flex items-center gap-1 opacity-60 cursor-not-allowed"
                              >
                                No PDF
                              </Button>
                            );
                            return (
                              <Button asChild size="sm" variant="default" className="flex items-center gap-1" title="Download PDF (Macchiato)">
                                <a href={href} target="_blank" rel="noopener">
                                  <Download className="h-3 w-3" /> PDF
                                </a>
                              </Button>
                            );
                          })()
                        }
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleRowReveal(student.id)}
                          className="flex items-center gap-1"
                          data-testid={`reveal-row-${student.id}`}
                          title={isRowRevealed(student.id) ? t('hide_pii_row') : t('show_pii_row')}
                        >
                          {isRowRevealed(student.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
        </div>
      </TabsContent>

      {/* AI Agent Tab: full-width, fills remaining height */}
      <TabsContent value="ai-agent" className="flex-1 min-h-0">
        <AdminAIAgentPanelV2 orgSlug={resolveOrg() || undefined} />
      </TabsContent>

      {/* Audit Tab */}
      <TabsContent value="audit" className="flex-1">
        <div className="mx-auto max-w-7xl w-full px-4 space-y-6 pb-8">
          {/* My Tiles */}
          <Card>
            <CardHeader>
              <CardTitle>My Activity (30d)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button variant="outline" className="justify-between" onClick={() => { setAuditAction('export_candidates_csv'); const email = (typeof window!=='undefined' && (localStorage.getItem('admin_email')||sessionStorage.getItem('admin_email')||''))||''; setAuditAdminEmail(email); }}>
                  <span>My CSV Exports</span>
                  <span className="font-bold">{auditMyStats.csv}</span>
                </Button>
                <Button variant="outline" className="justify-between" onClick={() => { setAuditAction('cv_presign'); const email = (typeof window!=='undefined' && (localStorage.getItem('admin_email')||sessionStorage.getItem('admin_email')||''))||''; setAuditAdminEmail(email); }}>
                  <span>My CV Downloads</span>
                  <span className="font-bold">{auditMyStats.presign}</span>
                </Button>
                <Button variant="outline" className="justify-between" onClick={() => { setAuditAction('admin_login_success'); const email = (typeof window!=='undefined' && (localStorage.getItem('admin_email')||sessionStorage.getItem('admin_email')||''))||''; setAuditAdminEmail(email); }}>
                  <span>My Logins</span>
                  <span className="font-bold">{auditMyStats.logins}</span>
                </Button>
              </div>
              {/* 7-day activity mini chart */}
              <div className="mt-4">
                <div className="text-sm text-muted-foreground mb-2">Activity (last 7 days)</div>
                <div className="flex items-end gap-2 h-28">
                  {series7.map(s => (
                    <div key={s.day} className="flex flex-col items-center gap-1">
                      <div
                        className="w-6 bg-primary/40 rounded-sm"
                        style={{ height: `${Math.max(6, Math.round((s.count / maxSeriesCount) * 96))}px` }}
                        title={`${s.day}: ${s.count}`}
                      />
                      <span className="text-[10px] text-muted-foreground">{s.day.slice(5)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Audit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex items-center gap-2">
                  <label className="text-sm">Range</label>
                  <select
                    className="bg-card border border-border rounded px-2 py-1 text-sm"
                    value={auditRange}
                    onChange={(e) => setAuditRange(e.target.value as any)}
                  >
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                {auditRange === 'custom' && (
                  <div className="flex items-center gap-2">
                    <input type="date" className="bg-card border border-border rounded px-2 py-1 text-sm" value={auditFrom} onChange={e => setAuditFrom(e.target.value)} />
                    <span>to</span>
                    <input type="date" className="bg-card border border-border rounded px-2 py-1 text-sm" value={auditTo} onChange={e => setAuditTo(e.target.value)} />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <label className="text-sm">Action</label>
                  <select className="bg-card border border-border rounded px-2 py-1 text-sm" value={auditAction} onChange={e=>setAuditAction(e.target.value)}>
                    <option value="">Any</option>
                    <option value="cv_presign">cv_presign</option>
                    <option value="export_candidates_csv">export_candidates_csv</option>
                    <option value="export_audit_csv">export_audit_csv</option>
                    <option value="admin_login_success">admin_login_success</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm">Candidate</label>
                  <Input placeholder="Full name contains…" value={auditCandidate} onChange={e=>setAuditCandidate(e.target.value)} className="h-8" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm">Admin</label>
                  <Input placeholder="email@company.com" value={auditAdminEmail} onChange={e=>setAuditAdminEmail(e.target.value)} className="h-8" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm">IP</label>
                  <Input placeholder="x.x.x.x" value={auditIP} onChange={e=>setAuditIP(e.target.value)} className="h-8" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm">User Agent</label>
                  <Input placeholder="Mozilla/…" value={auditUA} onChange={e=>setAuditUA(e.target.value)} className="h-8" />
                </div>
                <div className="ml-auto flex items-center gap-3">
                  {auditTotal > 0 && (
                    <span className="text-sm text-muted-foreground">
                      Showing {auditOffset + 1}-{Math.min(auditOffset + auditLimit, auditTotal)} of {auditTotal}
                    </span>
                  )}
                  <Button variant="default" size="sm" onClick={() => {
                    const org = resolveOrg(); if (!org) return; const sp = new URLSearchParams();
                    if (auditRange !== 'custom') {
                      const days = parseInt(auditRange, 10);
                      const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
                      sp.set('from', from)
                    } else {
                      if (auditFrom) sp.set('from', new Date(auditFrom).toISOString())
                      if (auditTo) sp.set('to', new Date(auditTo).toISOString())
                    }
                    if (auditAction) sp.set('action', auditAction)
                    if (auditAdminEmail) sp.set('admin_email', auditAdminEmail)
                    if (auditIP) sp.set('ip', auditIP)
                    if (auditUA) sp.set('user_agent', auditUA)
                    window.location.href = `/api/${org}/admin/audit/export?${sp.toString()}`
                  }}>Export Audit CSV</Button>
                  <Button variant="outline" size="sm" disabled={auditOffset === 0} onClick={() => setAuditOffset(Math.max(0, auditOffset - auditLimit))}>Prev</Button>
                  <Button variant="outline" size="sm" disabled={auditOffset + auditLimit >= auditTotal} onClick={() => setAuditOffset(auditOffset + auditLimit)}>Next</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {(!auditEvents || auditEvents.length === 0) ? (
                <div className="text-center py-8 space-y-3">
                  <p className="text-muted-foreground">No activity found.</p>
                  {(auditAction || auditAdminEmail || auditIP || auditUA) && (
                    <Button variant="outline" size="sm" onClick={() => {
                      setAuditAction('')
                      setAuditAdminEmail('')
                      setAuditIP('')
                      setAuditUA('')
                    }}>
                      Clear Filters
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead className="hidden md:table-cell">Org</TableHead>
                          <TableHead>Candidate</TableHead>
                          <TableHead>Admin Email</TableHead>
                          <TableHead className="hidden md:table-cell">IP</TableHead>
                          <TableHead className="hidden md:table-cell">User Agent</TableHead>
                          <TableHead className="hidden md:table-cell">Metadata</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditEvents.map((e: any, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{new Date(e.created_at).toLocaleString()}</TableCell>
                            <TableCell>{e.action}</TableCell>
                            <TableCell className="hidden md:table-cell">{e.org_name || '—'}</TableCell>
                            <TableCell>{e.candidate_name || e.candidate_id || '—'}</TableCell>
                            <TableCell>{e.admin_email || '—'}</TableCell>
                            <TableCell className="hidden md:table-cell">
                              {e.ip ? (
                                <button className="underline text-blue-600" onClick={() => { setAuditIP(e.ip || ''); }}>{e.ip}</button>
                              ) : '—'}
                            </TableCell>
                            <TableCell className="hidden md:table-cell max-w-[300px] truncate" title={e.user_agent || ''}>
                              {e.user_agent ? (
                                <button className="underline text-blue-600" onClick={() => { setAuditUA(e.user_agent || ''); }}>{e.user_agent}</button>
                              ) : '—'}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {e?.metadata ? (
                                <details>
                                  <summary className="cursor-pointer text-blue-600">View</summary>
                                  <pre className="max-w-[500px] whitespace-pre-wrap break-words text-xs bg-muted p-2 rounded">
                                    {JSON.stringify(e.metadata, null, 2)}
                                  </pre>
                                </details>
                              ) : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {/* Mobile list */}
                  <div className="md:hidden space-y-2">
                    {auditEvents.map((e: any, idx) => (
                      <div key={idx} className="rounded-md border p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{e.action}</span>
                          <span className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
                        </div>
                        <div className="mt-1 space-y-0.5">
                          <div>Candidate: {e.candidate_name || e.candidate_id || '—'}</div>
                          <div>Admin: {e.admin_email || '—'}</div>
                          {e.ip && (
                            <div>IP: <button className="underline" onClick={() => setAuditIP(e.ip || '')}>{e.ip}</button></div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Import Tab */}
      <TabsContent value="import" className="flex-1">
        <div className="mx-auto max-w-7xl w-full px-4 space-y-6 pb-8">
          <ImportTab orgSlug={resolveOrg() || ''} />
        </div>
      </TabsContent>
    </Tabs>
  );
}
