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

interface ReviewStepProps {
  cvData: CVData;
}

export function ReviewStep({ cvData }: ReviewStepProps) {
  const [selectedTemplate, setSelectedTemplate] = useState(cvData.template || 'minimal');
  const [selectedLanguage, setSelectedLanguage] = useState(cvData.language || 'en');
  const [isExporting, setIsExporting] = useState(false);

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
      const response = await fetch('/api/cv/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cvData, template: selectedTemplate, language: selectedLanguage }),
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
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
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
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">Arabic</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
