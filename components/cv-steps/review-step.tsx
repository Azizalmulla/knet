'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CVData } from '@/lib/cv-schemas';
import { MinimalTemplate } from '@/components/cv-templates/minimal-template';
import { ModernTemplate } from '@/components/cv-templates/modern-template';
import { CreativeTemplate } from '@/components/cv-templates/creative-template';
import { Download, FileText } from 'lucide-react';
import { getFields, getAreasForField, matchSuggestedVacancies } from '@/lib/career-map';

interface ReviewStepProps {
  cvData: CVData;
}

export function ReviewStep({ cvData }: ReviewStepProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<'minimal' | 'modern' | 'creative'>(cvData.template || 'minimal');
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'ar'>(cvData.language || 'en');
  const [isExporting, setIsExporting] = useState(false);
  const [fieldOfStudy, setFieldOfStudy] = useState<string>('');
  const [areaOfInterest, setAreaOfInterest] = useState<string>('');
  const [suggestedVacancies, setSuggestedVacancies] = useState<string | null>(null);

  const renderTemplate = () => {
    const templateData = { ...cvData, template: selectedTemplate, language: selectedLanguage };
    
    switch (selectedTemplate) {
      case 'modern':
        return <ModernTemplate data={templateData} />;
      case 'creative':
        return <CreativeTemplate data={templateData} />;
      default:
        return <MinimalTemplate data={templateData} />;
    }
  };

  const exportToPDF = () => {
    window.print();
  };

  const exportToDOCX = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/export/docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cvData, template: selectedTemplate, language: selectedLanguage }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${cvData.fullName?.replace(/\s+/g, '_')}_CV.docx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const submitCV = async () => {
    try {
      const vac = suggestedVacancies || (fieldOfStudy && areaOfInterest ? matchSuggestedVacancies(fieldOfStudy, areaOfInterest) : null);
      const response = await fetch('/api/cv/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...cvData, 
          template: selectedTemplate, 
          language: selectedLanguage,
          fieldOfStudy,
          areaOfInterest,
          suggestedVacancies: vac,
        }),
      });

      if (response.ok) {
        alert('CV submitted successfully!');
      }
    } catch (error) {
      console.error('Submission failed:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Customize Your CV</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Template</label>
              <Select value={selectedTemplate} onValueChange={(v) => setSelectedTemplate(v as 'minimal' | 'modern' | 'creative')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minimal">Minimal</SelectItem>
                  <SelectItem value="modern">Modern</SelectItem>
                  <SelectItem value="creative">Creative</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Language</label>
              <Select value={selectedLanguage} onValueChange={(v) => setSelectedLanguage(v as 'en' | 'ar')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">Arabic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Field of Study</label>
              <Select value={fieldOfStudy} onValueChange={(v) => { setFieldOfStudy(v); setAreaOfInterest(''); setSuggestedVacancies(null); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent>
                  {getFields().map(f => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Area of Interest</label>
              <Select 
                value={areaOfInterest}
                onValueChange={(v) => { setAreaOfInterest(v); setSuggestedVacancies(matchSuggestedVacancies(fieldOfStudy, v)); }}
                disabled={!fieldOfStudy}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select area" />
                </SelectTrigger>
                <SelectContent>
                  {fieldOfStudy && getAreasForField(fieldOfStudy).map(a => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {suggestedVacancies && (
              <div className="md:col-span-2 bg-zinc-50 border border-zinc-200 rounded-md p-3">
                <div className="text-sm font-medium mb-1">Suggested Vacancies</div>
                <ul className="list-disc pl-5 space-y-1">
                  {suggestedVacancies.split('/').map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={exportToPDF} variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button onClick={exportToDOCX} variant="outline" disabled={isExporting}>
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? 'Exporting...' : 'Export DOCX'}
            </Button>
            <Button onClick={submitCV} className="ml-auto">
              Submit to KNET
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`cv-preview ${selectedLanguage === 'ar' ? 'rtl' : 'ltr'}`}>
            {renderTemplate()}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
