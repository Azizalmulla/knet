'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, Search, UserCheck, UserX, Save, FileText, Mail, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { adminFetch } from '@/lib/admin-fetch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface RoleQuery {
  title: string;
  must: string[];
  nice: string[];
  minYears: number;
  language?: string;
  location?: string;
}

interface Candidate {
  studentId: string;
  fullName: string;
  email: string;
  fieldOfStudy: string;
  areaOfInterest: string;
  score: number;
  matchedSkills: string[];
  reasons: string[];
  gaps: string[];
  atsReadiness: 'high' | 'medium' | 'low';
}

interface RankingResult {
  summary: {
    role: string;
    totalCandidates: number;
    analyzed: number;
    topReasonsAcrossPool: string[];
    topGapsAcrossPool: string[];
  };
  results: Candidate[];
}

export function AIAgentPanel() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<RankingResult | null>(null);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [templates, setTemplates] = useState<any[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [candidateStatuses, setCandidateStatuses] = useState<Map<string, string>>(new Map());
  
  // Form state
  const [roleTitle, setRoleTitle] = useState('');
  const [mustHaveSkills, setMustHaveSkills] = useState('');
  const [niceToHaveSkills, setNiceToHaveSkills] = useState('');
  const [minYears, setMinYears] = useState(0);
  const [language, setLanguage] = useState('');
  const [location, setLocation] = useState('Kuwait');
  const [topK, setTopK] = useState(10);
  
  // Filters
  const [fieldFilter, setFieldFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [languageFilter, setLanguageFilter] = useState<'en' | 'ar' | 'both'>('both');
  
  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, []);
  
  const loadTemplates = async () => {
    try {
      const data = await adminFetch('/api/admin/agent/templates');
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };
  
  const saveAsTemplate = async () => {
    const name = prompt('Template name:');
    if (!name) return;
    
    try {
      await adminFetch('/api/admin/agent/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          title: roleTitle,
          mustHaveSkills: mustHaveSkills.split(',').map(s => s.trim()).filter(Boolean),
          niceToHaveSkills: niceToHaveSkills.split(',').map(s => s.trim()).filter(Boolean),
          minYears,
          language,
          location,
        }),
      });
      toast.success('Template saved');
      loadTemplates();
    } catch (error) {
      toast.error('Failed to save template');
    }
  };
  
  const loadTemplate = (template: any) => {
    setRoleTitle(template.title);
    setMustHaveSkills(template.mustHaveSkills?.join(', ') || '');
    setNiceToHaveSkills(template.niceToHaveSkills?.join(', ') || '');
    setMinYears(template.minYears || 0);
    setLanguage(template.language || '');
    setLocation(template.location || 'Kuwait');
    setShowTemplates(false);
    toast.success('Template loaded');
  };
  
  const handleRankCandidates = async () => {
    if (!roleTitle.trim()) {
      toast.error('Please enter a job title');
      return;
    }
    
    setLoading(true);
    try {
      const data = await adminFetch('/api/admin/agent/rank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: {
            title: roleTitle,
            must: mustHaveSkills.split(',').map(s => s.trim()).filter(Boolean),
            nice: niceToHaveSkills.split(',').map(s => s.trim()).filter(Boolean),
            minYears,
            language,
            location,
          },
          topK,
          filters: {
            fieldOfStudy: fieldFilter || undefined,
            areaOfInterest: areaFilter || undefined,
            language: languageFilter,
          },
        }),
      });
      setResults(data);
      toast.success(`Found ${data.results.length} matching candidates`);
      
    } catch (error: any) {
      console.error('Ranking error:', error);
      toast.error(error.message || 'Failed to rank candidates');
    } finally {
      setLoading(false);
    }
  };
  
  const handleExportCSV = () => {
    if (!results) return;
    
    const csv = [
      // Headers
      ['Name', 'Email', 'Field', 'Area', 'Score', 'Matched Skills', 'Top Reasons', 'Gaps', 'ATS Readiness'],
      // Data rows
      ...results.results.map(c => [
        c.fullName,
        c.email,
        c.fieldOfStudy,
        c.areaOfInterest,
        c.score.toString(),
        c.matchedSkills.join('; '),
        c.reasons.join('; '),
        c.gaps.join('; '),
        c.atsReadiness,
      ]),
    ];
    
    const csvContent = csv.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `candidates-${roleTitle.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('CSV exported successfully');
  };
  
  const toggleCandidate = (studentId: string) => {
    const newSelected = new Set(selectedCandidates);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedCandidates(newSelected);
  };
  
  const updateCandidateStatus = async (studentId: string, status: string) => {
    try {
      await adminFetch('/api/admin/agent/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: parseInt(studentId),
          status,
          roleTitle,
        }),
      });
      setCandidateStatuses(prev => new Map(prev).set(studentId, status));
      toast.success(`Candidate ${status}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };
  
  const bulkUpdateStatus = async (status: string) => {
    if (selectedCandidates.size === 0) return;
    
    try {
      await adminFetch('/api/admin/agent/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentIds: Array.from(selectedCandidates).map(id => parseInt(id)),
          status,
          roleTitle,
        }),
      });
      selectedCandidates.forEach(id => {
        setCandidateStatuses(prev => new Map(prev).set(id, status));
      });
      toast.success(`${selectedCandidates.size} candidates ${status}`);
      setSelectedCandidates(new Set());
    } catch (error) {
      toast.error('Failed to update statuses');
    }
  };
  
  const generateEmail = async (candidate: Candidate, type: 'shortlist' | 'reject') => {
    try {
      const data = await adminFetch('/api/admin/agent/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          candidateName: candidate.fullName,
          candidateEmail: candidate.email,
          roleTitle,
          reasons: candidate.reasons,
          gaps: candidate.gaps,
        }),
      });
      // Open mailto link
      window.location.href = data.mailtoLink;
    } catch (error) {
      toast.error('Failed to generate email');
    }
  };

  const getScoreBadgeVariant = (score: number) => (score >= 80 ? 'default' : score >= 60 ? 'secondary' : 'destructive');
  const getATSBadgeVariant = (readiness: string) => (readiness === 'high' ? 'default' : readiness === 'medium' ? 'secondary' : 'outline');

  return (
    <div className="space-y-6">
      {/* Query Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">AI Recruitment Assistant</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="role-title">Job Title *</Label>
              <Input id="role-title" placeholder="e.g., Frontend Developer" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Input id="location" placeholder="e.g., Kuwait" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          </div>

          <div>
            <Label htmlFor="must-have">Must-Have Skills (comma-separated)</Label>
            <Textarea id="must-have" placeholder="React, TypeScript, REST APIs" value={mustHaveSkills} onChange={(e) => setMustHaveSkills(e.target.value)} rows={2} />
          </div>

          <div>
            <Label htmlFor="nice-to-have">Nice-to-Have Skills (comma-separated)</Label>
            <Textarea id="nice-to-have" placeholder="Tailwind, Next.js, Playwright" value={niceToHaveSkills} onChange={(e) => setNiceToHaveSkills(e.target.value)} rows={2} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="min-years">Min Years Experience</Label>
              <Input id="min-years" type="number" min="0" value={minYears} onChange={(e) => setMinYears(parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <Label htmlFor="language">Preferred Language</Label>
              <Input id="language" placeholder="e.g., Arabic, English" value={language} onChange={(e) => setLanguage(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="top-k">Top Candidates</Label>
              <Input id="top-k" type="number" min="1" max="50" value={topK} onChange={(e) => setTopK(parseInt(e.target.value) || 10)} />
            </div>
          </div>

          {/* Filters */}
          <div className="border-t pt-4">
            <Label className="text-sm text-muted-foreground mb-2 block">Optional Filters</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="field-filter" className="text-xs">Field of Study</Label>
                <Input id="field-filter" placeholder="e.g., Computer Science" value={fieldFilter} onChange={(e) => setFieldFilter(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="area-filter" className="text-xs">Area of Interest</Label>
                <Input id="area-filter" placeholder="e.g., Web Development" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="lang-filter" className="text-xs">CV Language</Label>
                <Select value={languageFilter} onValueChange={(v: any) => setLanguageFilter(v)}>
                  <SelectTrigger id="lang-filter"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Both</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ar">Arabic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleRankCandidates} disabled={loading} className="flex-1">
              {loading ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing...</>) : (<><Search className="h-4 w-4 mr-2" />Rank Candidates</>)}
            </Button>
            <Button onClick={saveAsTemplate} variant="outline" title="Save as template"><Save className="h-4 w-4" /></Button>
            <Button onClick={() => setShowTemplates(!showTemplates)} variant="outline" title="Load template"><BookOpen className="h-4 w-4" /></Button>
            {results && (<Button onClick={handleExportCSV} variant="outline"><Download className="h-4 w-4 mr-2" />Export CSV</Button>)}
          </div>

          {showTemplates && templates.length > 0 && (
            <div className="border rounded-lg p-2 bg-background shadow-lg">
              <p className="text-sm font-medium mb-2">Saved Templates:</p>
              <div className="space-y-1">
                {templates.map((template) => (
                  <Button key={template.id} variant="ghost" className="w-full justify-start text-sm" onClick={() => loadTemplate(template)}>
                    <FileText className="h-3 w-3 mr-2" />
                    {template.name} - {template.title}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {results && (
        <>
          {/* Summary */}
          <Card>
            <CardHeader><CardTitle>Analysis Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div><p className="text-sm text-muted-foreground">Role</p><p className="font-semibold">{results.summary.role}</p></div>
                <div><p className="text-sm text-muted-foreground">Total Candidates</p><p className="font-semibold">{results.summary.totalCandidates}</p></div>
                <div><p className="text-sm text-muted-foreground">Analyzed</p><p className="font-semibold">{results.summary.analyzed}</p></div>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-medium mb-1">Top Strengths Across Pool:</p>
                  <div className="flex flex-wrap gap-1">{results.summary.topReasonsAcrossPool.map((reason, i) => (<Badge key={i} variant="secondary">{reason}</Badge>))}</div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Common Gaps:</p>
                  <div className="flex flex-wrap gap-1">{results.summary.topGapsAcrossPool.map((gap, i) => (<Badge key={i} variant="outline">{gap}</Badge>))}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Candidates Table */}
          <Card>
            <CardHeader><CardTitle>Top Candidates</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Select</TableHead>
                    <TableHead>Candidate</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead>Matched Skills</TableHead>
                    <TableHead>Top Reasons</TableHead>
                    <TableHead>Gaps</TableHead>
                    <TableHead className="text-center">ATS</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.results.map((candidate) => (
                    <TableRow key={candidate.studentId}>
                      <TableCell>
                        <input type="checkbox" checked={selectedCandidates.has(candidate.studentId)} onChange={() => toggleCandidate(candidate.studentId)} className="rounded" />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{candidate.fullName}</p>
                          <p className="text-sm text-muted-foreground">{candidate.fieldOfStudy}</p>
                          <p className="text-xs text-muted-foreground">{candidate.areaOfInterest}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center"><Badge variant={getScoreBadgeVariant(candidate.score)}>{candidate.score}</Badge></TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {candidate.matchedSkills.slice(0, 3).map((skill, i) => (<Badge key={i} variant="secondary" className="text-xs">{skill}</Badge>))}
                          {candidate.matchedSkills.length > 3 && (<Badge variant="outline" className="text-xs">+{candidate.matchedSkills.length - 3}</Badge>)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <ul className="text-sm space-y-0.5 max-w-xs">{candidate.reasons.slice(0, 2).map((reason, i) => (<li key={i} className="text-foreground">• {reason}</li>))}</ul>
                      </TableCell>
                      <TableCell>
                        <ul className="text-sm space-y-0.5 max-w-xs">{candidate.gaps.slice(0, 2).map((gap, i) => (<li key={i} className="text-destructive">• {gap}</li>))}</ul>
                      </TableCell>
                      <TableCell className="text-center"><Badge variant={getATSBadgeVariant(candidate.atsReadiness)}>{candidate.atsReadiness}</Badge></TableCell>
                      <TableCell className="text-center">
                        <div className="flex gap-1 justify-center">
                          {candidateStatuses.get(candidate.studentId) === 'shortlisted' ? (
                            <Badge variant="secondary">Shortlisted</Badge>
                          ) : candidateStatuses.get(candidate.studentId) === 'rejected' ? (
                            <Badge variant="destructive">Rejected</Badge>
                          ) : (
                            <>
                              <Button size="sm" variant="ghost" title="Shortlist" onClick={() => updateCandidateStatus(candidate.studentId, 'shortlisted')}>
                                <UserCheck className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" title="Reject" onClick={() => updateCandidateStatus(candidate.studentId, 'rejected')}>
                                <UserX className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="ghost" title="Send Email" onClick={() => generateEmail(candidate, candidateStatuses.get(candidate.studentId) === 'rejected' ? 'reject' : 'shortlist')}>
                            <Mail className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {selectedCandidates.size > 0 && (
                <div className="mt-4 p-3 bg-muted rounded-lg flex items-center justify-between">
                  <span className="text-sm">{selectedCandidates.size} candidate(s) selected</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus('shortlisted')}>
                      <UserCheck className="h-4 w-4 mr-1" />
                      Bulk Shortlist
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus('rejected')}>
                      <UserX className="h-4 w-4 mr-1" />
                      Bulk Reject
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
