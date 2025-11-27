'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Sparkles, Upload, Mic, FileText, CheckCircle2, AlertCircle,
  Loader2, ChevronRight, User, Mail, Phone, GraduationCap, Briefcase,
  Code, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import type { CVData } from '@/lib/cv-schemas';

interface SmartCVEntryProps {
  onComplete: (cvData: CVData) => void;
  orgSlug?: string;
}

interface MissingField {
  field: string;
  label: string;
  required: boolean;
  value: string;
}

type Stage = 'input' | 'extracting' | 'missing' | 'generating' | 'complete';

export function SmartCVEntry({ onComplete, orgSlug }: SmartCVEntryProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [stage, setStage] = useState<Stage>('input');
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Extraction results
  const [cvData, setCvData] = useState<Partial<CVData> | null>(null);
  const [missingFields, setMissingFields] = useState<MissingField[]>([]);
  const [stats, setStats] = useState<any>(null);
  
  // Generation animation
  const [generatingSections, setGeneratingSections] = useState<string[]>([]);
  const [currentSection, setCurrentSection] = useState('');

  // Handle text extraction
  const handleExtract = async () => {
    if (!inputText.trim() || inputText.length < 10) {
      setError('Please enter more information about yourself');
      return;
    }

    setIsLoading(true);
    setError(null);
    setStage('extracting');

    try {
      const response = await fetch('/api/ai/extract-cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to extract data');
      }

      setCvData(result.cvData);
      setStats(result.stats);

      if (result.missingFields && result.missingFields.length > 0) {
        setMissingFields(result.missingFields.map((f: any) => ({ ...f, value: '' })));
        setStage('missing');
        toast.info('Almost there! Please fill in a few more details.');
      } else {
        await animateGeneration(result.cvData);
      }
    } catch (err: any) {
      console.error('Extraction error:', err);
      setError(err.message || 'Failed to extract information');
      setStage('input');
      toast.error(err.message || 'Extraction failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setStage('extracting');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/cv/parse', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to parse file');
      }

      // Convert parsed CV to our format
      const cvData = convertParsedCV(result);
      setCvData(cvData);

      // Check for missing fields
      const missing = detectMissingFields(cvData);
      if (missing.length > 0) {
        setMissingFields(missing);
        setStage('missing');
      } else {
        await animateGeneration(cvData as CVData);
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to parse file');
      setStage('input');
      toast.error(err.message || 'Upload failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Convert parsed CV format to our format
  const convertParsedCV = (parsed: any): Partial<CVData> => {
    return {
      fullName: parsed.fullName || '',
      email: parsed.email || '',
      phone: parsed.phone || '+965 ',
      location: parsed.location || 'Kuwait',
      headline: parsed.headline || '',
      summary: parsed.summary || '',
      education: (parsed.education || []).map((edu: any) => ({
        institution: edu.institution || '',
        degree: edu.degree || '',
        fieldOfStudy: edu.field || edu.fieldOfStudy || '',
        startDate: edu.startDate || '',
        endDate: edu.endDate || '',
        currentlyStudying: false,
        gpa: edu.gpa?.toString() || '',
        description: ''
      })),
      experienceProjects: (parsed.experience || []).map((exp: any) => ({
        type: 'experience' as const,
        company: exp.company || '',
        position: exp.title || exp.position || '',
        startDate: exp.startDate || '',
        endDate: exp.endDate || '',
        current: exp.current || false,
        description: exp.description || '',
        bullets: exp.achievements || [],
      })),
      skills: {
        technical: parsed.skills?.technical || [],
        frameworks: parsed.skills?.frameworks || [],
        tools: parsed.skills?.tools || [],
        databases: parsed.skills?.databases || [],
        cloud: parsed.skills?.cloud || [],
        languages: parsed.skills?.languages || ['English', 'Arabic'],
        soft: parsed.skills?.soft || [],
      },
      certifications: parsed.certifications || [],
      achievements: parsed.achievements || [],
      links: {
        linkedin: parsed.linkedIn || '',
        github: '',
        portfolio: parsed.portfolio || '',
      },
    };
  };

  // Detect missing fields
  const detectMissingFields = (data: Partial<CVData>): MissingField[] => {
    const missing: MissingField[] = [];
    
    if (!data.fullName || data.fullName.trim().length < 2) {
      missing.push({ field: 'fullName', label: 'Full Name', required: true, value: '' });
    }
    if (!data.email || !data.email.includes('@')) {
      missing.push({ field: 'email', label: 'Email Address', required: true, value: '' });
    }
    if (!data.phone || data.phone.replace(/\D/g, '').length < 8) {
      missing.push({ field: 'phone', label: 'Phone Number', required: true, value: '' });
    }
    if (!data.education || data.education.length === 0) {
      missing.push({ field: 'education', label: 'Education', required: true, value: '' });
    }
    
    return missing;
  };

  // Update missing field
  const updateMissingField = (field: string, value: string) => {
    setMissingFields(prev => prev.map(f => f.field === field ? { ...f, value } : f));
  };

  // Submit with missing fields
  const submitWithMissingFields = async () => {
    const updatedData = { ...cvData };
    
    for (const field of missingFields) {
      if (field.value) {
        if (field.field === 'education') {
          (updatedData as any).education = [{
            institution: field.value,
            degree: 'Bachelor\'s',
            fieldOfStudy: '',
            startDate: '',
            endDate: '',
            currentlyStudying: false,
            gpa: '',
            description: ''
          }];
        } else {
          (updatedData as any)[field.field] = field.value;
        }
      }
    }
    
    setCvData(updatedData);
    await animateGeneration(updatedData as CVData);
  };

  // Animate CV generation
  const animateGeneration = async (data: CVData) => {
    setStage('generating');
    setGeneratingSections([]);

    const sections = [
      { key: 'header', label: 'Contact Info' },
      { key: 'summary', label: 'Summary' },
      { key: 'education', label: 'Education' },
      { key: 'experience', label: 'Experience' },
      { key: 'skills', label: 'Skills' },
    ];

    for (const section of sections) {
      setCurrentSection(section.key);
      await new Promise(r => setTimeout(r, 400 + Math.random() * 200));
      setGeneratingSections(prev => [...prev, section.key]);
    }

    setCurrentSection('');
    setStage('complete');
    setCvData(data);
    toast.success('CV ready! Review and customize below.');
    
    // Small delay then call onComplete
    setTimeout(() => {
      onComplete(data);
    }, 500);
  };

  // Navigate to voice
  const goToVoice = () => {
    router.push(orgSlug ? `/voice-cv?org=${orgSlug}` : '/voice-cv');
  };

  return (
    <div className="space-y-6">
      {/* Main Input Card */}
      {stage === 'input' && (
        <Card className="rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111]">
          <CardHeader className="bg-gradient-to-r from-violet-500 to-purple-600 text-white border-b-[3px] border-black rounded-t-2xl">
            <CardTitle className="text-2xl font-black flex items-center gap-2">
              <Sparkles className="w-6 h-6" />
              Smart CV Builder
            </CardTitle>
            <CardDescription className="text-violet-100 text-base">
              Paste anything about yourself - AI does the rest
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Main Text Input */}
            <div className="space-y-3">
              <Label className="text-lg font-bold">Tell me about yourself</Label>
              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Paste anything here:
• Copy-paste from your old CV
• Your LinkedIn "About" section
• Or just type: "I'm Ahmed, CS graduate from Kuwait University 2023, worked at Zain as a developer for 2 years, I know React and Python"`}
                className="min-h-[200px] border-[3px] border-black rounded-xl text-base"
              />
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Badge variant="outline" className="border-black">Tip</Badge>
                The more you share, the better your CV will be
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                onClick={handleExtract}
                disabled={isLoading || inputText.length < 10}
                size="lg"
                className="flex-1 rounded-2xl border-[3px] border-black bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white font-bold text-lg py-6 shadow-[4px_4px_0_#111] hover:shadow-[2px_2px_0_#111] hover:-translate-y-0.5 transition-all"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Generate My CV
                  </>
                )}
              </Button>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-2 border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-4 text-gray-500 font-medium">or</span>
              </div>
            </div>

            {/* Alternative Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".pdf,.doc,.docx"
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                size="lg"
                className="rounded-2xl border-[3px] border-black bg-white font-bold py-6 shadow-[4px_4px_0_#111] hover:shadow-[2px_2px_0_#111] hover:-translate-y-0.5 transition-all"
              >
                <Upload className="w-5 h-5 mr-2" />
                Upload Existing CV
              </Button>
              <Button
                onClick={goToVoice}
                variant="outline"
                size="lg"
                className="rounded-2xl border-[3px] border-black bg-white font-bold py-6 shadow-[4px_4px_0_#111] hover:shadow-[2px_2px_0_#111] hover:-translate-y-0.5 transition-all"
              >
                <Mic className="w-5 h-5 mr-2" />
                Use Voice Instead
              </Button>
            </div>

            {/* Error */}
            {error && (
              <Alert className="border-2 border-red-500 bg-red-50">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <AlertDescription className="text-red-700">{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Extracting Stage */}
      {stage === 'extracting' && (
        <Card className="rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111]">
          <CardContent className="p-12">
            <div className="text-center space-y-6">
              <div className="w-24 h-24 mx-auto rounded-full border-4 border-black bg-violet-100 flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-violet-600 animate-spin" />
              </div>
              <div>
                <h3 className="text-2xl font-black">Analyzing your information...</h3>
                <p className="text-gray-600 mt-2">AI is extracting your CV data</p>
              </div>
              <Progress value={45} className="h-3 max-w-md mx-auto border-2 border-black" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Missing Fields Stage */}
      {stage === 'missing' && (
        <Card className="rounded-2xl border-[3px] border-amber-500 bg-white shadow-[6px_6px_0_#f59e0b]">
          <CardHeader className="bg-amber-100 border-b-[3px] border-amber-500 rounded-t-2xl">
            <CardTitle className="text-2xl font-black flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-amber-600" />
              Almost there!
            </CardTitle>
            <CardDescription className="text-gray-700">
              I extracted most of your info. Just need a few more details:
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* What we found */}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {stats.name && (
                  <div className="p-3 rounded-xl border-2 border-green-500 bg-green-50 text-center">
                    <User className="w-5 h-5 mx-auto text-green-600" />
                    <p className="text-xs mt-1 font-medium text-green-700">Name ✓</p>
                  </div>
                )}
                {stats.education > 0 && (
                  <div className="p-3 rounded-xl border-2 border-green-500 bg-green-50 text-center">
                    <GraduationCap className="w-5 h-5 mx-auto text-green-600" />
                    <p className="text-xs mt-1 font-medium text-green-700">{stats.education} Education ✓</p>
                  </div>
                )}
                {stats.experience > 0 && (
                  <div className="p-3 rounded-xl border-2 border-green-500 bg-green-50 text-center">
                    <Briefcase className="w-5 h-5 mx-auto text-green-600" />
                    <p className="text-xs mt-1 font-medium text-green-700">{stats.experience} Experience ✓</p>
                  </div>
                )}
                {stats.skills > 0 && (
                  <div className="p-3 rounded-xl border-2 border-green-500 bg-green-50 text-center">
                    <Code className="w-5 h-5 mx-auto text-green-600" />
                    <p className="text-xs mt-1 font-medium text-green-700">{stats.skills} Skills ✓</p>
                  </div>
                )}
              </div>
            )}

            {/* Missing fields form */}
            <div className="space-y-4">
              <p className="font-bold text-gray-700">Please fill in:</p>
              {missingFields.map((field) => (
                <div key={field.field} className="space-y-2">
                  <Label className="font-bold flex items-center gap-2">
                    {field.required && <span className="text-red-500">*</span>}
                    {field.label}
                  </Label>
                  <Input
                    value={field.value}
                    onChange={(e) => updateMissingField(field.field, e.target.value)}
                    placeholder={
                      field.field === 'email' ? 'your.email@example.com' :
                      field.field === 'phone' ? '+965 1234 5678' :
                      field.field === 'education' ? 'Kuwait University' :
                      `Enter your ${field.label.toLowerCase()}`
                    }
                    className="border-2 border-black rounded-xl"
                  />
                </div>
              ))}
            </div>

            <Button
              onClick={submitWithMissingFields}
              disabled={missingFields.filter(f => f.required).some(f => !f.value.trim())}
              size="lg"
              className="w-full rounded-2xl border-[3px] border-black bg-amber-400 hover:bg-amber-500 text-black font-bold text-lg py-6 shadow-[4px_4px_0_#111] hover:shadow-[2px_2px_0_#111] hover:-translate-y-0.5 transition-all"
            >
              <ArrowRight className="w-5 h-5 mr-2" />
              Continue & Generate CV
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Generating Stage */}
      {stage === 'generating' && cvData && (
        <Card className="rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111]">
          <CardHeader className="bg-gradient-to-r from-violet-500 to-purple-600 text-white border-b-[3px] border-black rounded-t-2xl">
            <CardTitle className="text-2xl font-black flex items-center gap-2">
              <Sparkles className="w-6 h-6" />
              Building Your CV...
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <Progress 
                value={20 + (generatingSections.length * 16)} 
                className="h-3 border-2 border-black" 
              />
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Left: Progress */}
                <div className="space-y-3">
                  {['header', 'summary', 'education', 'experience', 'skills'].map((section) => (
                    <div 
                      key={section}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                        generatingSections.includes(section) 
                          ? 'border-green-500 bg-green-50' 
                          : currentSection === section
                          ? 'border-violet-500 bg-violet-50'
                          : 'border-gray-200 bg-gray-50 opacity-50'
                      }`}
                    >
                      {generatingSections.includes(section) ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : currentSection === section ? (
                        <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                      )}
                      <span className="font-medium capitalize">{section}</span>
                    </div>
                  ))}
                </div>

                {/* Right: Preview */}
                <div className="p-4 rounded-xl border-[3px] border-black bg-gray-50">
                  <p className="text-sm text-gray-500 mb-3">Preview:</p>
                  <div className="space-y-2">
                    <p className={`font-bold text-lg ${generatingSections.includes('header') ? 'opacity-100' : 'opacity-30'}`}>
                      {(cvData as any).fullName || 'Your Name'}
                    </p>
                    <p className={`text-sm text-gray-600 ${generatingSections.includes('header') ? 'opacity-100' : 'opacity-30'}`}>
                      {(cvData as any).email} • {(cvData as any).phone}
                    </p>
                    {generatingSections.includes('education') && (cvData as any).education?.[0] && (
                      <p className="text-sm">🎓 {(cvData as any).education[0].institution}</p>
                    )}
                    {generatingSections.includes('experience') && (cvData as any).experienceProjects?.[0] && (
                      <p className="text-sm">💼 {(cvData as any).experienceProjects[0].company || (cvData as any).experienceProjects[0].name}</p>
                    )}
                    {generatingSections.includes('skills') && (
                      <p className="text-sm">🔧 {Object.values((cvData as any).skills || {}).flat().slice(0, 3).join(', ')}...</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Complete Stage */}
      {stage === 'complete' && (
        <Card className="rounded-2xl border-[3px] border-green-500 bg-white shadow-[6px_6px_0_#22c55e]">
          <CardContent className="p-8">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 mx-auto rounded-full border-4 border-green-500 bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-2xl font-black text-green-700">CV Generated!</h3>
              <p className="text-gray-600">Loading editor for final touches...</p>
              <Loader2 className="w-6 h-6 mx-auto animate-spin text-green-600" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
