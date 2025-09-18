'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Search, Filter, Eye, EyeOff, Users } from 'lucide-react';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { redactEmail, redactPhone, redactName } from '@/lib/redact';
import { adminFetch } from '@/lib/admin-fetch';
import { useLanguage } from '@/lib/language';
import TelemetryToday from '@/components/admin/TelemetryToday';
import { AdminAIAgentPanel } from '@/components/admin/AdminAIAgentPanel';

interface Student {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  field_of_study: string;
  area_of_interest: string;
  cv_type: string;
  cv_url: string;
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
}

// Guard hook to normalize empty string to undefined for Select components
function useSelectSafe<T extends string | undefined>(v: T) {
  return v && v.length ? v : undefined;
}

export default function AdminDashboard() {
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
  const [revealedRows, setRevealedRows] = useState<Set<number>>(new Set());
  const [adminToken, setAdminToken] = useState<string>('');

  useEffect(() => {
    fetchStudents();
  }, []);

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

  const fetchStudents = async () => {
    try {
      const data = await adminFetch('/api/admin/students');
      setStudents(data.students || []);
    } catch (error) {
      console.error('Error fetching students:', error);
      // If auth error, trigger inline login modal and wait for re-auth
      if (error instanceof Error && error.message.includes('ADMIN_FETCH_401') && typeof window !== 'undefined') {
        try { window.dispatchEvent(new CustomEvent('admin-auth-required')); } catch {}
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

  const pdfHref = (id: number) => {
    const params = new URLSearchParams();
    if (adminToken) params.set('token', adminToken);
    if (lang) params.set('lang', lang);
    const qs = params.toString();
    return `/api/cv/${id}/pdf${qs ? `?${qs}` : ''}`;
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

  const toggleRowReveal = (studentId: number) => {
    const newRevealed = new Set(revealedRows);
    if (newRevealed.has(studentId)) {
      newRevealed.delete(studentId);
    } else {
      newRevealed.add(studentId);
    }
    setRevealedRows(newRevealed);
  };

  const toggleGlobalPII = () => {
    setShowPII(!showPII);
    if (showPII) {
      setRevealedRows(new Set());
    }
  };

  const isRowRevealed = (studentId: number) => showPII || revealedRows.has(studentId);

  const getDisplayValue = (value: string, type: 'name' | 'email' | 'phone', studentId: number) => {
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
    const headers = ['Name', 'Email', 'Phone', 'Field of Study', 'Area of Interest', 'Degree (Watheefti)', 'YoE (Watheefti)', 'Area (Watheefti)', 'Suggested Vacancies', 'CV Type', 'Submitted Date'];
    const csvData = filteredStudents.map(student => [
      showPII ? student.full_name : redactName(student.full_name),
      showPII ? student.email : redactEmail(student.email),
      showPII ? student.phone : redactPhone(student.phone),
      student.field_of_study,
      student.area_of_interest,
      student.knet_profile?.degreeBucket || '',
      student.knet_profile?.yearsOfExperienceBucket || '',
      student.knet_profile?.areaOfInterest || '',
      student.suggested_vacancies || '',
      student.cv_type,
      new Date(student.submitted_at).toLocaleDateString()
    ]);
    
    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `knet_students_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Mount point for top header tabs (must be declared before any early return)
  const [tabsSlot, setTabsSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setTabsSlot(document.getElementById('admin-tabs-slot') as HTMLElement | null);
  }, []);

  const TabsListContent = (
    <TabsList className="flex items-center gap-2 rounded-md border bg-card px-1 py-1">
      <TabsTrigger value="students" className="flex items-center gap-2">
        <Users className="h-4 w-4" />
        <span className="hidden sm:inline">{t('student_cvs')}</span>
        <span className="sm:hidden">{t('student_cvs')}</span>
      </TabsTrigger>
      <TabsTrigger value="ai-agent" className="flex items-center gap-2">
        {t('ai_agent')}
      </TabsTrigger>
    </TabsList>
  );

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
      <Card className="mb-6">
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
                  <SelectValue placeholder="Degree (Watheefti)" />
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
                  <SelectValue placeholder="YoE (Watheefti)" />
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
                  <SelectValue placeholder="Area (Watheefti)" />
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
        <Button onClick={exportToCSV} variant="outline" className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          {t('export_csv')} ({filteredStudents.length})
        </Button>
        
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{students.length}</div>
            <p className="text-xs text-muted-foreground">{t('total_submissions')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{students.filter(s => s.cv_type === 'uploaded').length}</div>
            <p className="text-xs text-muted-foreground">{t('uploaded_cvs')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{students.filter(s => s.cv_type === 'ai').length}</div>
            <p className="text-xs text-muted-foreground">{t('ai_generated_cvs')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{filteredStudents.length}</div>
            <p className="text-xs text-muted-foreground">{t('filtered_results')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Events Today Telemetry */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('events_today')}</CardTitle>
        </CardHeader>
        <CardContent>
          <TelemetryToday />
        </CardContent>
      </Card>

      {/* Students Table */}
      <Card>
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
                  <TableHead className="text-left">Degree (W)</TableHead>
                  <TableHead className="text-left">YoE (W)</TableHead>
                  <TableHead className="text-left">Area (W)</TableHead>
                  <TableHead className="text-left">GPA</TableHead>
                  <TableHead className="text-left">{t('table_suggested_vacancies')}</TableHead>
                  <TableHead className="text-left">{t('table_cv_type')}</TableHead>
                  <TableHead className="text-left">{t('table_submitted')}</TableHead>
                  <TableHead className="text-left">Parse</TableHead>
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
                      <Badge variant={statusVariant((student as any).cv_parse_status)}>
                        {(student as any).cv_parse_status ? String((student as any).cv_parse_status).toUpperCase() : '—'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {student.cv_url ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadCV(student.cv_url, student.full_name)}
                            className="flex items-center gap-1"
                          >
                            <Download className="h-3 w-3" />
                            {t('download')}
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" disabled title="No file">
                            <Download className="h-3 w-3" /> N/A
                          </Button>
                        )}
                        <Button asChild size="sm" variant="default" className="flex items-center gap-1" title="Download PDF">
                          <a href={pdfHref(student.id)} target="_blank" rel="noopener">
                            <Download className="h-3 w-3" /> PDF
                          </a>
                        </Button>
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
        <AdminAIAgentPanel />
      </TabsContent>
    </Tabs>
  );
}
