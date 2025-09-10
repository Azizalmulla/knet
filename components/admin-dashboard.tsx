'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Search, Filter, Eye, EyeOff, Users, Sparkles } from 'lucide-react';
import { redactEmail, redactPhone, redactName } from '@/lib/redact';
import { adminFetch } from '@/lib/admin-fetch';
import { useLanguage } from '@/lib/language';
import TelemetryToday from '@/components/admin/TelemetryToday';
import { AIAgentPanel } from '@/components/admin/AIAgentPanel';

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
}

// Guard hook to normalize empty string to undefined for Select components
function useSelectSafe<T extends string | undefined>(v: T) {
  return v && v.length ? v : undefined;
}

export default function AdminDashboard() {
  const { t } = useLanguage();
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [fieldFilter, setFieldFilter] = useState<string | undefined>(undefined);
  const [interestFilter, setInterestFilter] = useState<string | undefined>(undefined);
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [vacancyFilter, setVacancyFilter] = useState('');
  const [showPII, setShowPII] = useState(false);
  const [revealedRows, setRevealedRows] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    filterStudents();
  }, [students, searchTerm, fieldFilter, interestFilter, typeFilter, vacancyFilter]);

  const fetchStudents = async () => {
    try {
      const data = await adminFetch('/api/admin/students');
      setStudents(data.students || []);
    } catch (error) {
      console.error('Error fetching students:', error);
      // If auth error, redirect to login
      if (error instanceof Error && error.message.includes('ADMIN_FETCH_401')) {
        sessionStorage.removeItem('admin_token');
        window.location.reload();
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

  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Field of Study', 'Area of Interest', 'Suggested Vacancies', 'CV Type', 'Submitted Date'];
    const csvData = filteredStudents.map(student => [
      showPII ? student.full_name : redactName(student.full_name),
      showPII ? student.email : redactEmail(student.email),
      showPII ? student.phone : redactPhone(student.phone),
      student.field_of_study,
      student.area_of_interest,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">{t('admin_loading')}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">{t('admin_dashboard')}</h1>
        <p className="text-gray-600">{t('admin_dashboard_subtitle')}</p>
      </div>

      {/* Tabs for different admin views */}
      <Tabs defaultValue="students" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="students" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Student CVs
          </TabsTrigger>
          <TabsTrigger value="ai-agent" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI Agent
          </TabsTrigger>
        </TabsList>

        {/* Students Tab */}
        <TabsContent value="students" className="space-y-6">
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
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm('');
                  setFieldFilter(undefined);
                  setInterestFilter(undefined);
                  setTypeFilter(undefined);
                  setVacancyFilter('');
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
          <div className="text-sm text-gray-600">
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
          <CardTitle>Events Today</CardTitle>
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
            <div className="text-center py-8 text-gray-500">
              {t('no_students_found')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">{t('table_name')}</th>
                    <th className="text-left py-3 px-4">{t('table_email')}</th>
                    <th className="text-left py-3 px-4">{t('table_phone')}</th>
                    <th className="text-left py-3 px-4">{t('table_field')}</th>
                    <th className="text-left py-3 px-4">{t('table_interest')}</th>
                    <th className="text-left py-3 px-4">{t('table_suggested_vacancies')}</th>
                    <th className="text-left py-3 px-4">{t('table_cv_type')}</th>
                    <th className="text-left py-3 px-4">{t('table_submitted')}</th>
                    <th className="text-left py-3 px-4">{t('table_actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium" data-testid={`student-name-${student.id}`}>
                        {getDisplayValue(student.full_name, 'name', student.id)}
                      </td>
                      <td className="py-3 px-4" data-testid={`student-email-${student.id}`}>
                        {getDisplayValue(student.email, 'email', student.id)}
                      </td>
                      <td className="py-3 px-4" data-testid={`student-phone-${student.id}`}>
                        {getDisplayValue(student.phone, 'phone', student.id)}
                      </td>
                      <td className="py-3 px-4">{student.field_of_study}</td>
                      <td className="py-3 px-4">{student.area_of_interest}</td>
                      <td className="py-3 px-4">
                        {student.suggested_vacancies ? (
                          <div className="space-y-1">
                            <div className="flex flex-wrap gap-1">
                              {student.suggested_vacancies.split('/').map((item) => (
                                <span
                                  key={item}
                                  className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700"
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                            <div className="text-xs text-zinc-500">
                              <span className="font-medium">Raw:</span> {student.suggested_vacancies}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          student.cv_type === 'ai' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {student.cv_type === 'ai' ? t('ai_generated') : t('uploaded')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {new Date(student.submitted_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadCV(student.cv_url, student.full_name)}
                            className="flex items-center gap-1"
                          >
                            <Download className="h-3 w-3" />
                            {t('download')}
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        {/* AI Agent Tab */}
        <TabsContent value="ai-agent">
          <AIAgentPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
