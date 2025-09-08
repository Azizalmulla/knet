'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Search, Filter } from 'lucide-react';

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

export default function AdminDashboard() {
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [fieldFilter, setFieldFilter] = useState('');
  const [interestFilter, setInterestFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [vacancyFilter, setVacancyFilter] = useState('');

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    filterStudents();
  }, [students, searchTerm, fieldFilter, interestFilter, typeFilter, vacancyFilter]);

  const fetchStudents = async () => {
    try {
      const response = await fetch('/api/admin/students');
      if (response.ok) {
        const data = await response.json();
        setStudents(data.students || []);
      }
    } catch (error) {
      console.error('Failed to fetch students:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterStudents = () => {
    let filtered = students;

    if (searchTerm) {
      filtered = filtered.filter(student => 
        student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(searchTerm.toLowerCase())
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

  const uniqueFields = [...new Set(students.map(s => s.field_of_study))];
  const uniqueInterests = [...new Set(students.map(s => s.area_of_interest))];
  const uniqueVacancies = [...new Set(students.flatMap(s => s.suggested_vacancies_list || []))];

  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Field of Study', 'Area of Interest', 'Suggested Vacancies', 'CV Type', 'Submitted Date'];
    const csvData = filteredStudents.map(student => [
      student.full_name,
      student.email,
      student.phone,
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
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">Manage student CV submissions and downloads.</p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <Select value={fieldFilter} onValueChange={setFieldFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Field of Study" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Fields</SelectItem>
                  {uniqueFields.map(field => (
                    <SelectItem key={field} value={field}>{field}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={interestFilter} onValueChange={setInterestFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Area of Interest" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Interests</SelectItem>
                  {uniqueInterests.map(interest => (
                    <SelectItem key={interest} value={interest}>{interest}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="CV Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Types</SelectItem>
                  <SelectItem value="uploaded">Uploaded</SelectItem>
                  <SelectItem value="ai">AI Generated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Input
                placeholder="Filter by suggested vacancy..."
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
                  setFieldFilter('');
                  setInterestFilter('');
                  setTypeFilter('');
                  setVacancyFilter('');
                }}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export */}
      <div className="mb-4">
        <Button onClick={exportToCSV} variant="outline" className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export CSV ({filteredStudents.length} rows)
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{students.length}</div>
            <p className="text-xs text-muted-foreground">Total Submissions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{students.filter(s => s.cv_type === 'uploaded').length}</div>
            <p className="text-xs text-muted-foreground">Uploaded CVs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{students.filter(s => s.cv_type === 'ai').length}</div>
            <p className="text-xs text-muted-foreground">AI Generated CVs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{filteredStudents.length}</div>
            <p className="text-xs text-muted-foreground">Filtered Results</p>
          </CardContent>
        </Card>
      </div>

      {/* Students Table */}
      <Card>
        <CardHeader>
          <CardTitle>Student Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredStudents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No students found matching your criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Name</th>
                    <th className="text-left py-3 px-4">Email</th>
                    <th className="text-left py-3 px-4">Phone</th>
                    <th className="text-left py-3 px-4">Field</th>
                    <th className="text-left py-3 px-4">Interest</th>
                    <th className="text-left py-3 px-4">Suggested Vacancies</th>
                    <th className="text-left py-3 px-4">CV Type</th>
                    <th className="text-left py-3 px-4">Submitted</th>
                    <th className="text-left py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{student.full_name}</td>
                      <td className="py-3 px-4">{student.email}</td>
                      <td className="py-3 px-4">{student.phone}</td>
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
                          {student.cv_type === 'ai' ? 'AI Generated' : 'Uploaded'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {new Date(student.submitted_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadCV(student.cv_url, student.full_name)}
                          className="flex items-center gap-1"
                        >
                          <Download className="h-3 w-3" />
                          Download
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
