'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Mic, Square, Play, Pause, Download, FileText, Zap,
  CheckCircle2, AlertCircle, Loader2, Volume2, RefreshCw,
  MessageCircle, Keyboard, ChevronRight, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import type { CVData } from '@/lib/cv-schemas';

interface VoiceToCVBuilderProps {
  onCVGenerated?: (cvData: CVData) => void;
  orgSlug?: string;
}

interface MissingField {
  field: string;
  label: string;
  required: boolean;
  value: string;
}

export function VoiceToCVBuilder({ onCVGenerated, orgSlug }: VoiceToCVBuilderProps) {
  const router = useRouter();
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  // Live transcription state
  const [liveTranscript, setLiveTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<'transcribing' | 'parsing' | 'generating' | 'done' | null>(null);
  
  // Missing fields state
  const [missingFields, setMissingFields] = useState<MissingField[]>([]);
  const [showMissingFieldsForm, setShowMissingFieldsForm] = useState(false);
  
  // CV Preview animation state
  const [generatingSections, setGeneratingSections] = useState<string[]>([]);
  const [currentSection, setCurrentSection] = useState<string>('');
  
  // Results
  const [cvData, setCvData] = useState<CVData | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, [audioUrl]);

  // Initialize Web Speech API for live transcription
  const initSpeechRecognition = useCallback(() => {
    if (typeof window === 'undefined') return null;
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.log('Speech recognition not supported');
      return null;
    }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript + ' ';
        } else {
          interim = transcript;
        }
      }
      
      if (final) {
        setLiveTranscript(prev => prev + final);
      }
      setInterimTranscript(interim);
    };
    
    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.error('Speech recognition error:', event.error);
      }
    };
    
    recognition.onend = () => {
      // Restart if still recording
      if (isRecording && !isPaused && recognitionRef.current) {
        try { recognitionRef.current.start(); } catch {}
      }
    };
    
    return recognition;
  }, [isRecording, isPaused]);

  // Detect missing required fields
  const detectMissingFields = useCallback((data: Partial<CVData>): MissingField[] => {
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
    if (!data.education || data.education.length === 0 || !data.education[0]?.institution) {
      missing.push({ field: 'education', label: 'Education (university name)', required: true, value: '' });
    }
    
    return missing;
  }, []);

  // Animate CV generation section by section
  const animateCVGeneration = async (data: CVData) => {
    const sections = ['header', 'summary', 'education', 'experience', 'skills'];
    setGeneratingSections([]);
    
    for (const section of sections) {
      setCurrentSection(section);
      await new Promise(r => setTimeout(r, 400 + Math.random() * 300));
      setGeneratingSections(prev => [...prev, section]);
    }
    
    setCurrentSection('');
    setProcessingStage('done');
  };

  // Start recording
  const startRecording = async () => {
    try {
      // Reset previous state
      setError(null);
      setCvData(null);
      setTranscript(null);
      setAudioBlob(null);
      setLiveTranscript('');
      setInterimTranscript('');
      setMissingFields([]);
      setShowMissingFieldsForm(false);
      setGeneratingSections([]);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      chunksRef.current = [];
      setRecordingTime(0);

      // Start Web Speech API for live transcription
      const recognition = initSpeechRecognition();
      if (recognition) {
        recognitionRef.current = recognition;
        try { recognition.start(); } catch {}
      }

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        }
      });

      // Create MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/wav';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        // Stop speech recognition
        if (recognitionRef.current) {
          try { recognitionRef.current.stop(); } catch {}
        }
        
        // Clear timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setIsPaused(false);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      toast.success('Recording started! Speak clearly about your background.');
    } catch (err: any) {
      console.error('Failed to start recording:', err);
      toast.error('Failed to access microphone. Please check permissions.');
      setError('Microphone access denied. Please allow microphone access and try again.');
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      toast.success('Recording saved! Click "Generate CV" to process.');
    }
  };

  // Pause/Resume recording
  const togglePause = () => {
    if (!mediaRecorderRef.current) return;

    if (mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
      toast.info('Recording paused');
    } else if (mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      toast.info('Recording resumed');
    }
  };

  // Process audio and generate CV
  const generateCV = async (additionalData?: Partial<CVData>) => {
    if (!audioBlob) {
      toast.error('No recording found. Please record first.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProcessingStage('transcribing');
    setShowMissingFieldsForm(false);

    try {
      // Create form data
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice-recording.webm');
      formData.append('language', 'auto'); // Auto-detect language

      // Send to API
      const response = await fetch('/api/voice-to-cv', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to process audio');
      }

      setProcessingStage('parsing');

      const result = await response.json();

      if (!result.success || !result.cvData) {
        throw new Error('Invalid response from server');
      }

      setTranscript(result.transcript);
      
      // Merge any additional data (from missing fields form)
      let finalCvData = { ...result.cvData };
      if (additionalData) {
        finalCvData = { ...finalCvData, ...additionalData };
        // Handle education specially
        if (additionalData.education) {
          finalCvData.education = additionalData.education;
        }
      }
      
      // Check for missing required fields
      const missing = detectMissingFields(finalCvData);
      
      if (missing.length > 0 && !additionalData) {
        // Show missing fields form
        setMissingFields(missing);
        setShowMissingFieldsForm(true);
        setCvData(finalCvData);
        setIsProcessing(false);
        setProcessingStage(null);
        toast.info('Almost there! Please fill in the missing details.');
        return;
      }

      // All good - animate CV generation
      setProcessingStage('generating');
      setCvData(finalCvData);
      await animateCVGeneration(finalCvData);

      toast.success('CV generated successfully! 🎉');

      // Call callback if provided
      if (onCVGenerated) {
        onCVGenerated(finalCvData);
      }

    } catch (err: any) {
      console.error('Failed to generate CV:', err);
      setError(err.message || 'Failed to process recording. Please try again.');
      toast.error(err.message || 'Failed to generate CV');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle missing field input change
  const updateMissingField = (field: string, value: string) => {
    setMissingFields(prev => 
      prev.map(f => f.field === field ? { ...f, value } : f)
    );
  };

  // Submit with filled missing fields
  const submitWithMissingFields = async () => {
    const additionalData: Partial<CVData> = {};
    
    for (const field of missingFields) {
      if (field.value) {
        if (field.field === 'education') {
          additionalData.education = [{
            institution: field.value,
            degree: cvData?.education?.[0]?.degree || 'Bachelor\'s',
            fieldOfStudy: cvData?.education?.[0]?.fieldOfStudy || '',
            startDate: '',
            endDate: '',
            currentlyStudying: false,
            gpa: '',
            description: ''
          }];
        } else {
          (additionalData as any)[field.field] = field.value;
        }
      }
    }
    
    // Merge with existing CV data and regenerate
    const mergedData = { ...cvData, ...additionalData } as CVData;
    setCvData(mergedData);
    setShowMissingFieldsForm(false);
    setIsProcessing(true);
    setProcessingStage('generating');
    
    await animateCVGeneration(mergedData);
    
    toast.success('CV generated successfully! 🎉');
    
    if (onCVGenerated) {
      onCVGenerated(mergedData);
    }
    
    setIsProcessing(false);
  };

  // Download PDF
  const downloadPDF = async () => {
    if (!cvData) return;

    try {
      const response = await fetch('/api/cv/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cv: cvData, template: 'professional', language: cvData.language || 'en' }),
      });

      if (!response.ok) throw new Error('Failed to generate PDF');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cvData.fullName || 'CV'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success('PDF downloaded!');
    } catch (err) {
      toast.error('Failed to download PDF');
    }
  };

  // Submit to organization
  const submitCV = async () => {
    if (!cvData || !orgSlug) {
      toast.error('Missing CV data or organization');
      return;
    }

    try {
      // Build the knetProfile for watheefti taxonomy
      const knetProfile = {
        degreeBucket: cvData.education?.[0]?.degree || 'Others',
        yearsOfExperienceBucket: cvData.experienceProjects?.length 
          ? (cvData.experienceProjects.length > 3 ? '3-5 years' : '0-2 years')
          : 'Fresh Graduate',
        areaOfInterest: cvData.skills?.technical?.[0] || 'Technology',
      };

      // Submit using the CV submit endpoint (for AI-generated CVs)
      const submitResponse = await fetch('/api/cv/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...cvData,
          orgSlug,
          cvType: 'ai',
          fieldOfStudy: cvData.education?.[0]?.fieldOfStudy || 'Not specified',
          areaOfInterest: cvData.skills?.technical?.[0] || 'Technology',
          knetProfile,
          template: cvData.template || 'professional',
        }),
      });

      if (!submitResponse.ok) {
        const errorData = await submitResponse.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Failed to submit CV');
      }

      toast.success('CV submitted successfully! 🎉');
      router.push(`/${orgSlug}/start?submitted=true`);
    } catch (err: any) {
      console.error('Submit CV error:', err);
      toast.error(err.message || 'Failed to submit CV');
    }
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Recording Card */}
      <Card className="rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111]">
        <CardHeader className="bg-[#e0d6cb] border-b-[3px] border-black rounded-t-2xl">
          <CardTitle className="text-2xl font-black flex items-center gap-2">
            <Mic className="w-6 h-6" />
            Voice-to-CV Builder
          </CardTitle>
          <CardDescription className="text-base font-medium text-gray-700">
            Speak for 2-3 minutes about your background, experience, and skills
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          
          {/* Instructions (before recording) */}
          {!isRecording && !audioBlob && !cvData && (
            <Alert className="rounded-xl border-[3px] border-black bg-[#d5ddd8] shadow-[4px_4px_0_#111]">
              <Zap className="w-4 h-4 text-black" />
              <AlertDescription>
                <p className="font-bold mb-2">What to say:</p>
                <ul className="space-y-1 text-sm">
                  <li>✅ Your name and contact info (email, phone)</li>
                  <li>✅ Education (degree, university, graduation year)</li>
                  <li>✅ Work experience (companies, roles, achievements)</li>
                  <li>✅ Skills (technical, languages, soft skills)</li>
                  <li>✅ Projects you've worked on</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Recording Controls */}
          <div className="flex flex-col items-center gap-6">
            {/* Recording Indicator with Live Transcription */}
            {isRecording && (
              <div className="flex flex-col items-center gap-4 w-full">
                <div className="relative">
                  <div className={`w-32 h-32 rounded-full border-4 border-black flex items-center justify-center ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`}>
                    <Volume2 className="w-16 h-16 text-white" />
                  </div>
                  <Badge className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-black text-white font-mono text-lg px-4 py-2">
                    {formatTime(recordingTime)}
                  </Badge>
                </div>
                <p className="text-lg font-bold">
                  {isPaused ? '⏸️ Paused' : '🎙️ Recording...'}
                </p>
                
                {/* Live Transcription Box */}
                <div className="w-full max-w-lg p-4 rounded-xl border-[3px] border-black bg-gray-50 min-h-[100px]">
                  <p className="text-xs text-gray-500 mb-2 font-bold flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Live transcription:
                  </p>
                  <p className="text-gray-800 text-sm">
                    {liveTranscript}
                    <span className="text-gray-400 italic">{interimTranscript}</span>
                    {!liveTranscript && !interimTranscript && (
                      <span className="text-gray-400 italic">Listening... Start speaking!</span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Audio Playback */}
            {audioUrl && !isRecording && (
              <div className="w-full max-w-md">
                <div className="flex items-center gap-4 p-4 border-2 border-black rounded-lg bg-gray-50">
                  <Volume2 className="w-6 h-6" />
                  <audio controls src={audioUrl} className="flex-1" />
                </div>
                <p className="text-sm text-center text-gray-600 mt-2">
                  Duration: {formatTime(recordingTime)}
                </p>
              </div>
            )}

            {/* Control Buttons */}
            <div className="flex gap-4">
              {!isRecording && !audioBlob && (
                <Button
                  onClick={startRecording}
                  size="lg"
                  className="rounded-2xl border-[3px] border-black bg-red-500 hover:bg-red-600 text-white font-bold text-lg px-8 py-6 shadow-[4px_4px_0_#111] hover:shadow-[2px_2px_0_#111] hover:-translate-y-0.5 transition-all"
                >
                  <Mic className="w-6 h-6 mr-2" />
                  Start Recording
                </Button>
              )}

              {isRecording && (
                <>
                  <Button
                    onClick={togglePause}
                    size="lg"
                    variant="outline"
                    className="rounded-2xl border-[3px] border-black bg-white font-bold shadow-[4px_4px_0_#111] hover:shadow-[2px_2px_0_#111] hover:-translate-y-0.5 transition-all"
                  >
                    {isPaused ? <Play className="w-5 h-5 mr-2" /> : <Pause className="w-5 h-5 mr-2" />}
                    {isPaused ? 'Resume' : 'Pause'}
                  </Button>
                  <Button
                    onClick={stopRecording}
                    size="lg"
                    className="rounded-2xl border-[3px] border-black bg-black text-white hover:bg-gray-800 font-bold shadow-[4px_4px_0_#111] hover:shadow-[2px_2px_0_#111] hover:-translate-y-0.5 transition-all"
                  >
                    <Square className="w-5 h-5 mr-2" />
                    Stop & Save
                  </Button>
                </>
              )}

              {audioBlob && !isRecording && !cvData && (
                <>
                  <Button
                    onClick={startRecording}
                    size="lg"
                    variant="outline"
                    className="rounded-2xl border-[3px] border-black bg-white font-bold shadow-[4px_4px_0_#111] hover:shadow-[2px_2px_0_#111] hover:-translate-y-0.5 transition-all"
                  >
                    <RefreshCw className="w-5 h-5 mr-2" />
                    Re-record
                  </Button>
                  <Button
                    onClick={() => generateCV()}
                    size="lg"
                    disabled={isProcessing}
                    className="rounded-2xl border-[3px] border-black bg-black hover:bg-neutral-800 text-white font-bold px-8 shadow-[4px_4px_0_#111] hover:shadow-[2px_2px_0_#111] hover:-translate-y-0.5 transition-all"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-5 h-5 mr-2" />
                        Generate CV
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>

            {/* Processing Progress with Live CV Preview */}
            {isProcessing && (
              <div className="w-full max-w-lg space-y-4">
                <Progress value={
                  processingStage === 'transcribing' ? 25 : 
                  processingStage === 'parsing' ? 50 : 
                  processingStage === 'generating' ? 75 + (generatingSections.length * 5) : 100
                } className="h-3 border-2 border-black" />
                <div className="flex justify-between text-sm">
                  <span className={processingStage === 'transcribing' ? 'font-bold' : 'text-gray-400'}>
                    {processingStage === 'transcribing' ? '🎙️ Transcribing...' : '✓ Transcribed'}
                  </span>
                  <span className={processingStage === 'parsing' ? 'font-bold' : 'text-gray-400'}>
                    {processingStage === 'parsing' ? '🤖 Parsing...' : processingStage === 'generating' || processingStage === 'done' ? '✓ Parsed' : 'Parsing'}
                  </span>
                  <span className={processingStage === 'generating' ? 'font-bold' : processingStage === 'done' ? 'font-bold text-green-500' : 'text-gray-400'}>
                    {processingStage === 'generating' ? '✨ Generating...' : processingStage === 'done' ? '✓ Done!' : 'Generate'}
                  </span>
                </div>
                
                {/* Live CV Preview during generation */}
                {processingStage === 'generating' && cvData && (
                  <div className="p-4 rounded-xl border-[3px] border-black bg-white shadow-[4px_4px_0_#111]">
                    <p className="text-xs text-gray-500 mb-3 font-bold">Building your CV...</p>
                    <div className="space-y-2">
                      <div className={`flex items-center gap-2 ${generatingSections.includes('header') ? 'opacity-100' : 'opacity-30'}`}>
                        {generatingSections.includes('header') ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Loader2 className="w-4 h-4 animate-spin" />}
                        <span className="font-bold">{cvData.fullName}</span>
                      </div>
                      <div className={`flex items-center gap-2 ${generatingSections.includes('summary') ? 'opacity-100' : 'opacity-30'}`}>
                        {generatingSections.includes('summary') ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : currentSection === 'summary' ? <Loader2 className="w-4 h-4 animate-spin" /> : <div className="w-4 h-4" />}
                        <span className="text-sm text-gray-600">Summary</span>
                      </div>
                      <div className={`flex items-center gap-2 ${generatingSections.includes('education') ? 'opacity-100' : 'opacity-30'}`}>
                        {generatingSections.includes('education') ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : currentSection === 'education' ? <Loader2 className="w-4 h-4 animate-spin" /> : <div className="w-4 h-4" />}
                        <span className="text-sm text-gray-600">Education ({cvData.education?.length || 0})</span>
                      </div>
                      <div className={`flex items-center gap-2 ${generatingSections.includes('experience') ? 'opacity-100' : 'opacity-30'}`}>
                        {generatingSections.includes('experience') ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : currentSection === 'experience' ? <Loader2 className="w-4 h-4 animate-spin" /> : <div className="w-4 h-4" />}
                        <span className="text-sm text-gray-600">Experience ({cvData.experienceProjects?.length || 0})</span>
                      </div>
                      <div className={`flex items-center gap-2 ${generatingSections.includes('skills') ? 'opacity-100' : 'opacity-30'}`}>
                        {generatingSections.includes('skills') ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : currentSection === 'skills' ? <Loader2 className="w-4 h-4 animate-spin" /> : <div className="w-4 h-4" />}
                        <span className="text-sm text-gray-600">Skills ({Object.values(cvData.skills || {}).flat().length})</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <Alert className="border-2 border-red-500 bg-red-50">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <AlertDescription className="text-red-700">{error}</AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Missing Fields Card */}
      {showMissingFieldsForm && missingFields.length > 0 && (
        <Card className="rounded-2xl border-[3px] border-amber-500 bg-white shadow-[6px_6px_0_#f59e0b]">
          <CardHeader className="bg-amber-100 border-b-[3px] border-amber-500 rounded-t-2xl">
            <CardTitle className="text-2xl font-black flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-amber-600" />
              Almost there!
            </CardTitle>
            <CardDescription className="font-medium text-gray-700">
              I noticed some missing information. Please fill in the details below:
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {missingFields.map((field) => (
              <div key={field.field} className="space-y-2">
                <Label className="font-bold flex items-center gap-2">
                  {field.required && <span className="text-red-500">*</span>}
                  {field.label}
                </Label>
                <Input
                  value={field.value}
                  onChange={(e) => updateMissingField(field.field, e.target.value)}
                  placeholder={`Enter your ${field.label.toLowerCase()}`}
                  className="border-2 border-black rounded-xl"
                />
              </div>
            ))}
            
            <div className="flex gap-4 pt-4">
              <Button
                onClick={submitWithMissingFields}
                disabled={missingFields.filter(f => f.required).some(f => !f.value.trim())}
                className="flex-1 rounded-2xl border-[3px] border-black bg-amber-400 hover:bg-amber-500 text-black font-bold shadow-[4px_4px_0_#111] hover:shadow-[2px_2px_0_#111] hover:-translate-y-0.5 transition-all"
              >
                <ChevronRight className="w-5 h-5 mr-2" />
                Continue & Generate CV
              </Button>
              <Button
                onClick={startRecording}
                variant="outline"
                className="rounded-2xl border-[3px] border-black bg-white font-bold shadow-[4px_4px_0_#111]"
              >
                <Mic className="w-5 h-5 mr-2" />
                Record More
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Card */}
      {cvData && !showMissingFieldsForm && processingStage === 'done' && (
        <Card className="rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111]">
          <CardHeader className="bg-[#d2dbd5] border-b-[3px] border-black rounded-t-2xl">
            <CardTitle className="text-2xl font-black flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-black" />
              CV Generated Successfully!
            </CardTitle>
            <CardDescription className="font-medium text-gray-700">Review your information below</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            
            {/* CV Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border-[3px] border-black bg-[#eeeee4] shadow-[3px_3px_0_#111]">
                <p className="text-sm text-gray-600 mb-1">Name</p>
                <p className="font-bold">{cvData.fullName}</p>
              </div>
              <div className="p-4 rounded-xl border-[3px] border-black bg-[#eeeee4] shadow-[3px_3px_0_#111]">
                <p className="text-sm text-gray-600 mb-1">Email</p>
                <p className="font-bold">{cvData.email}</p>
              </div>
              <div className="p-4 rounded-xl border-[3px] border-black bg-[#eeeee4] shadow-[3px_3px_0_#111]">
                <p className="text-sm text-gray-600 mb-1">Phone</p>
                <p className="font-bold">{cvData.phone}</p>
              </div>
              <div className="p-4 rounded-xl border-[3px] border-black bg-[#eeeee4] shadow-[3px_3px_0_#111]">
                <p className="text-sm text-gray-600 mb-1">Location</p>
                <p className="font-bold">{cvData.location}</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-xl border-[3px] border-black bg-white shadow-[3px_3px_0_#111]">
                <p className="text-3xl font-black">{cvData.education?.length || 0}</p>
                <p className="text-sm text-gray-600">Education</p>
              </div>
              <div className="text-center p-4 rounded-xl border-[3px] border-black bg-white shadow-[3px_3px_0_#111]">
                <p className="text-3xl font-black">{cvData.experienceProjects?.length || 0}</p>
                <p className="text-sm text-gray-600">Experience</p>
              </div>
              <div className="text-center p-4 rounded-xl border-[3px] border-black bg-white shadow-[3px_3px_0_#111]">
                <p className="text-3xl font-black">
                  {Object.values(cvData.skills || {}).flat().length}
                </p>
                <p className="text-sm text-gray-600">Skills</p>
              </div>
            </div>

            {/* Transcript Preview */}
            {transcript && (
              <div className="p-4 rounded-xl border-[3px] border-black bg-[#bde0fe] shadow-[3px_3px_0_#111]">
                <p className="font-bold mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Transcript:
                </p>
                <p className="text-sm text-gray-700 italic line-clamp-3">{transcript}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-4">
              <Button
                onClick={downloadPDF}
                className="flex-1 rounded-2xl border-[3px] border-black bg-[#e0d6cb] hover:bg-[#d5ccc1] text-black font-bold shadow-[4px_4px_0_#111] hover:shadow-[2px_2px_0_#111] hover:-translate-y-0.5 transition-all"
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
              {orgSlug && (
                <Button
                  onClick={submitCV}
                  className="flex-1 rounded-2xl border-[3px] border-black bg-black hover:bg-neutral-800 text-white font-bold shadow-[4px_4px_0_#111] hover:shadow-[2px_2px_0_#111] hover:-translate-y-0.5 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Submit to {orgSlug}
                </Button>
              )}
              <Button
                onClick={() => router.push(`/ai-builder?prefill=${encodeURIComponent(JSON.stringify(cvData))}`)}
                className="rounded-2xl border-[3px] border-black bg-white hover:bg-gray-50 text-black font-bold shadow-[4px_4px_0_#111] hover:shadow-[2px_2px_0_#111] hover:-translate-y-0.5 transition-all"
              >
                <FileText className="w-4 h-4 mr-2" />
                Edit in Builder
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
