'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  FileText, Edit3, Save, X, Download, Eye, Loader2, 
  RefreshCw, ArrowLeft, User, Mail, Phone, MapPin,
  Briefcase, GraduationCap, Code, FolderOpen, Plus, Trash2
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface CVData {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  location?: string;
  summary?: string;
  education?: Array<{
    institution: string;
    degree: string;
    field: string;
    startDate?: string;
    endDate?: string;
    gpa?: number;
  }>;
  experience?: Array<{
    company: string;
    title: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  }>;
  skills?: {
    technical?: string[];
    soft?: string[];
    languages?: string[];
  };
  projects?: Array<{
    name: string;
    description?: string;
    technologies?: string[];
  }>;
  cvBlobKey?: string;
  parseStatus?: string;
}

export default function CandidateCVPage() {
  const [cv, setCV] = useState<CVData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedCV, setEditedCV] = useState<CVData | null>(null);

  useEffect(() => {
    fetchCV();
  }, []);

  const fetchCV = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/candidate/cv');
      if (!res.ok) throw new Error('Failed to load CV');
      const data = await res.json();
      setCV(data.cv);
      setEditedCV(data.cv);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveCV = async () => {
    if (!editedCV) return;
    
    setSaving(true);
    try {
      const res = await fetch('/api/candidate/cv', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedCV)
      });
      
      if (!res.ok) throw new Error('Failed to save CV');
      
      setCV(editedCV);
      setEditing(false);
      toast.success('CV saved successfully!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof CVData, value: any) => {
    if (!editedCV) return;
    setEditedCV({ ...editedCV, [field]: value });
  };

  const addSkill = (type: 'technical' | 'soft' | 'languages', skill: string) => {
    if (!editedCV || !skill.trim()) return;
    const skills = editedCV.skills || { technical: [], soft: [], languages: [] };
    const existing = skills[type] || [];
    if (!existing.includes(skill.trim())) {
      setEditedCV({
        ...editedCV,
        skills: {
          ...skills,
          [type]: [...existing, skill.trim()]
        }
      });
    }
  };

  const removeSkill = (type: 'technical' | 'soft' | 'languages', skill: string) => {
    if (!editedCV) return;
    const skills = editedCV.skills || { technical: [], soft: [], languages: [] };
    setEditedCV({
      ...editedCV,
      skills: {
        ...skills,
        [type]: (skills[type] || []).filter(s => s !== skill)
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#eeeee4] p-8">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111] p-12 text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
            <p className="font-bold">Loading your CV...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!cv) {
    return (
      <div className="min-h-screen bg-[#eeeee4] p-8">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111] p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">No CV found</h3>
            <p className="text-gray-600 mb-6">Upload or create a CV to get started</p>
            <div className="flex gap-4 justify-center">
              <Button asChild className="rounded-xl border-[3px] border-black bg-white text-black shadow-[3px_3px_0_#111] hover:-translate-y-0.5 transition-all font-bold">
                <Link href="/start">
                  <FileText className="w-4 h-4 mr-2" />
                  Upload CV
                </Link>
              </Button>
              <Button asChild className="rounded-xl border-[3px] border-black bg-[#FFEACC] text-black shadow-[3px_3px_0_#111] hover:-translate-y-0.5 transition-all font-bold">
                <Link href="/career/ai-builder">
                  <Edit3 className="w-4 h-4 mr-2" />
                  Build with AI
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const displayCV = editing ? editedCV : cv;

  return (
    <div className="min-h-screen bg-[#eeeee4] p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <Link href="/career/dashboard" className="text-sm text-gray-600 hover:text-black flex items-center gap-1 mb-2">
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </Link>
            <h1 className="text-3xl font-black">Your CV</h1>
            <p className="text-gray-600">View and edit your profile information</p>
          </div>
          <div className="flex gap-3">
            {cv.cvBlobKey && (
              <Button
                asChild
                className="rounded-xl border-[3px] border-black bg-white text-black shadow-[3px_3px_0_#111] hover:-translate-y-0.5 transition-all font-bold"
              >
                <a href={cv.cvBlobKey} target="_blank" rel="noopener noreferrer">
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </a>
              </Button>
            )}
            {editing ? (
              <>
                <Button
                  onClick={() => {
                    setEditing(false);
                    setEditedCV(cv);
                  }}
                  className="rounded-xl border-[3px] border-black bg-white text-black shadow-[3px_3px_0_#111] hover:-translate-y-0.5 transition-all font-bold"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={saveCV}
                  disabled={saving}
                  className="rounded-xl border-[3px] border-black bg-[#a7f3d0] text-black shadow-[3px_3px_0_#111] hover:-translate-y-0.5 transition-all font-bold"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </>
            ) : (
              <Button
                onClick={() => setEditing(true)}
                className="rounded-xl border-[3px] border-black bg-[#FFEACC] text-black shadow-[3px_3px_0_#111] hover:-translate-y-0.5 transition-all font-bold"
              >
                <Edit3 className="w-4 h-4 mr-2" />
                Edit CV
              </Button>
            )}
          </div>
        </div>

        {/* Personal Info */}
        <div className="rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111] p-6">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
            <User className="w-5 h-5" />
            Personal Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-bold text-gray-600">Full Name</label>
              {editing ? (
                <Input
                  value={editedCV?.fullName || ''}
                  onChange={(e) => updateField('fullName', e.target.value)}
                  className="mt-1 border-[2px] border-black rounded-lg"
                />
              ) : (
                <p className="mt-1 font-medium">{displayCV?.fullName || '-'}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-bold text-gray-600">Email</label>
              <p className="mt-1 font-medium flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                {displayCV?.email || '-'}
              </p>
            </div>
            <div>
              <label className="text-sm font-bold text-gray-600">Phone</label>
              {editing ? (
                <Input
                  value={editedCV?.phone || ''}
                  onChange={(e) => updateField('phone', e.target.value)}
                  className="mt-1 border-[2px] border-black rounded-lg"
                />
              ) : (
                <p className="mt-1 font-medium flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400" />
                  {displayCV?.phone || '-'}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-bold text-gray-600">Location</label>
              {editing ? (
                <Input
                  value={editedCV?.location || ''}
                  onChange={(e) => updateField('location', e.target.value)}
                  className="mt-1 border-[2px] border-black rounded-lg"
                />
              ) : (
                <p className="mt-1 font-medium flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  {displayCV?.location || '-'}
                </p>
              )}
            </div>
          </div>
          {(displayCV?.summary || editing) && (
            <div className="mt-4">
              <label className="text-sm font-bold text-gray-600">Summary</label>
              {editing ? (
                <Textarea
                  value={editedCV?.summary || ''}
                  onChange={(e) => updateField('summary', e.target.value)}
                  className="mt-1 border-[2px] border-black rounded-lg"
                  rows={3}
                />
              ) : (
                <p className="mt-1 text-gray-700">{displayCV?.summary || '-'}</p>
              )}
            </div>
          )}
        </div>

        {/* Skills */}
        <div className="rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111] p-6">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
            <Code className="w-5 h-5" />
            Skills
          </h2>
          
          {/* Technical Skills */}
          <div className="mb-4">
            <label className="text-sm font-bold text-gray-600">Technical Skills</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {(displayCV?.skills?.technical || []).map((skill, idx) => (
                <span 
                  key={idx} 
                  className="px-3 py-1 rounded-full border-[2px] border-black bg-[#bde0fe] font-medium text-sm flex items-center gap-1"
                >
                  {skill}
                  {editing && (
                    <button onClick={() => removeSkill('technical', skill)} className="ml-1 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
              {editing && (
                <input
                  type="text"
                  placeholder="Add skill..."
                  className="px-3 py-1 border-[2px] border-dashed border-gray-300 rounded-full text-sm w-32"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addSkill('technical', (e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                />
              )}
            </div>
          </div>

          {/* Soft Skills */}
          <div className="mb-4">
            <label className="text-sm font-bold text-gray-600">Soft Skills</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {(displayCV?.skills?.soft || []).map((skill, idx) => (
                <span 
                  key={idx} 
                  className="px-3 py-1 rounded-full border-[2px] border-black bg-[#ffd6a5] font-medium text-sm flex items-center gap-1"
                >
                  {skill}
                  {editing && (
                    <button onClick={() => removeSkill('soft', skill)} className="ml-1 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
              {editing && (
                <input
                  type="text"
                  placeholder="Add skill..."
                  className="px-3 py-1 border-[2px] border-dashed border-gray-300 rounded-full text-sm w-32"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addSkill('soft', (e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                />
              )}
            </div>
          </div>

          {/* Languages */}
          <div>
            <label className="text-sm font-bold text-gray-600">Languages</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {(displayCV?.skills?.languages || []).map((lang, idx) => (
                <span 
                  key={idx} 
                  className="px-3 py-1 rounded-full border-[2px] border-black bg-[#d4f1dd] font-medium text-sm flex items-center gap-1"
                >
                  {lang}
                  {editing && (
                    <button onClick={() => removeSkill('languages', lang)} className="ml-1 hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
              {editing && (
                <input
                  type="text"
                  placeholder="Add language..."
                  className="px-3 py-1 border-[2px] border-dashed border-gray-300 rounded-full text-sm w-32"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addSkill('languages', (e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Experience */}
        {(displayCV?.experience?.length || 0) > 0 && (
          <div className="rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111] p-6">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
              <Briefcase className="w-5 h-5" />
              Experience
            </h2>
            <div className="space-y-4">
              {displayCV?.experience?.map((exp, idx) => (
                <div key={idx} className="p-4 rounded-xl border-[2px] border-gray-200 bg-gray-50">
                  <h3 className="font-bold">{exp.title}</h3>
                  <p className="text-gray-600">{exp.company}</p>
                  <p className="text-sm text-gray-500">
                    {exp.startDate} - {exp.endDate || 'Present'}
                    {exp.location && ` • ${exp.location}`}
                  </p>
                  {exp.description && (
                    <p className="mt-2 text-gray-700 text-sm">{exp.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Education */}
        {(displayCV?.education?.length || 0) > 0 && (
          <div className="rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111] p-6">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
              <GraduationCap className="w-5 h-5" />
              Education
            </h2>
            <div className="space-y-4">
              {displayCV?.education?.map((edu, idx) => (
                <div key={idx} className="p-4 rounded-xl border-[2px] border-gray-200 bg-gray-50">
                  <h3 className="font-bold">{edu.degree} in {edu.field}</h3>
                  <p className="text-gray-600">{edu.institution}</p>
                  <p className="text-sm text-gray-500">
                    {edu.startDate} - {edu.endDate || 'Present'}
                    {edu.gpa && ` • GPA: ${edu.gpa}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Projects */}
        {(displayCV?.projects?.length || 0) > 0 && (
          <div className="rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111] p-6">
            <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
              <FolderOpen className="w-5 h-5" />
              Projects
            </h2>
            <div className="space-y-4">
              {displayCV?.projects?.map((proj, idx) => (
                <div key={idx} className="p-4 rounded-xl border-[2px] border-gray-200 bg-gray-50">
                  <h3 className="font-bold">{proj.name}</h3>
                  {proj.description && (
                    <p className="text-gray-700 text-sm mt-1">{proj.description}</p>
                  )}
                  {proj.technologies && proj.technologies.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {proj.technologies.map((tech, tidx) => (
                        <span key={tidx} className="px-2 py-0.5 bg-gray-200 rounded text-xs">
                          {tech}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
