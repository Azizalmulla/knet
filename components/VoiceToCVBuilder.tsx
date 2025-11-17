'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Mic, Square, Play, Pause, Download, FileText, Sparkles,
  CheckCircle2, AlertCircle, Loader2, Volume2, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import type { CVData } from '@/lib/cv-schemas';

interface VoiceToCVBuilderProps {
  onCVGenerated?: (cvData: CVData) => void;
  orgSlug?: string;
}

export function VoiceToCVBuilder({ onCVGenerated, orgSlug }: VoiceToCVBuilderProps) {
  const router = useRouter();
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<'transcribing' | 'parsing' | 'done' | null>(null);
  
  // Results
  const [cvData, setCvData] = useState<CVData | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, [audioUrl]);

  // Start recording
  const startRecording = async () => {
    try {
      // Reset previous state
      setError(null);
      setCvData(null);
      setTranscript(null);
      setAudioBlob(null);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      chunksRef.current = [];
      setRecordingTime(0);

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
  const generateCV = async () => {
    if (!audioBlob) {
      toast.error('No recording found. Please record first.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProcessingStage('transcribing');

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

      setProcessingStage('done');
      setCvData(result.cvData);
      setTranscript(result.transcript);

      toast.success('CV generated successfully! 🎉');

      // Call callback if provided
      if (onCVGenerated) {
        onCVGenerated(result.cvData);
      }

    } catch (err: any) {
      console.error('Failed to generate CV:', err);
      setError(err.message || 'Failed to process recording. Please try again.');
      toast.error(err.message || 'Failed to generate CV');
    } finally {
      setIsProcessing(false);
      setProcessingStage(null);
    }
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
      // Generate PDF first
      const pdfResponse = await fetch('/api/cv/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cv: cvData }),
      });

      if (!pdfResponse.ok) throw new Error('Failed to generate PDF');
      
      const pdfBlob = await pdfResponse.blob();
      
      // Upload PDF
      const uploadFormData = new FormData();
      uploadFormData.append('file', pdfBlob, `${cvData.fullName || 'CV'}.pdf`);
      uploadFormData.append('email', cvData.email);
      uploadFormData.append('name', cvData.fullName);
      uploadFormData.append('phone', cvData.phone || '');
      uploadFormData.append('org', orgSlug);
      uploadFormData.append('cv_data', JSON.stringify(cvData));

      const submitResponse = await fetch('/api/submit', {
        method: 'POST',
        body: uploadFormData,
      });

      if (!submitResponse.ok) throw new Error('Failed to submit CV');

      toast.success('CV submitted successfully! 🎉');
      router.push(`/${orgSlug}/start?submitted=true`);
    } catch (err: any) {
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
      <Card className="border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <CardHeader className="bg-gradient-to-r from-purple-100 to-blue-100 border-b-4 border-black">
          <CardTitle className="text-2xl font-black flex items-center gap-2">
            <Mic className="w-6 h-6" />
            Voice-to-CV Builder
          </CardTitle>
          <CardDescription className="text-base">
            Speak for 2-3 minutes about your background, experience, and skills
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          
          {/* Instructions (before recording) */}
          {!isRecording && !audioBlob && !cvData && (
            <Alert className="border-2 border-blue-500 bg-blue-50">
              <Sparkles className="w-4 h-4 text-blue-500" />
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
            {/* Recording Indicator */}
            {isRecording && (
              <div className="flex flex-col items-center gap-4">
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
                  className="bg-red-500 hover:bg-red-600 text-white font-bold text-lg px-8 py-6"
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
                    className="border-2 border-black font-bold"
                  >
                    {isPaused ? <Play className="w-5 h-5 mr-2" /> : <Pause className="w-5 h-5 mr-2" />}
                    {isPaused ? 'Resume' : 'Pause'}
                  </Button>
                  <Button
                    onClick={stopRecording}
                    size="lg"
                    className="bg-black text-white hover:bg-gray-800 font-bold"
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
                    className="border-2 border-black"
                  >
                    <RefreshCw className="w-5 h-5 mr-2" />
                    Re-record
                  </Button>
                  <Button
                    onClick={generateCV}
                    size="lg"
                    disabled={isProcessing}
                    className="bg-purple-500 hover:bg-purple-600 text-white font-bold px-8"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 mr-2" />
                        Generate CV
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>

            {/* Processing Progress */}
            {isProcessing && (
              <div className="w-full max-w-md space-y-3">
                <Progress value={processingStage === 'transcribing' ? 33 : processingStage === 'parsing' ? 66 : 100} className="h-3 border-2 border-black" />
                <div className="flex justify-between text-sm">
                  <span className={processingStage === 'transcribing' ? 'font-bold' : 'text-gray-400'}>
                    {processingStage === 'transcribing' ? '🎙️ Transcribing...' : '✓ Transcribed'}
                  </span>
                  <span className={processingStage === 'parsing' ? 'font-bold' : 'text-gray-400'}>
                    {processingStage === 'parsing' ? '🤖 Parsing...' : processingStage === 'done' ? '✓ Parsed' : 'Parsing'}
                  </span>
                  <span className={processingStage === 'done' ? 'font-bold text-green-500' : 'text-gray-400'}>
                    {processingStage === 'done' ? '✓ Done!' : 'Generate'}
                  </span>
                </div>
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

      {/* Results Card */}
      {cvData && (
        <Card className="border-4 border-green-500 shadow-[8px_8px_0px_0px_rgba(34,197,94,1)]">
          <CardHeader className="bg-green-50 border-b-4 border-green-500">
            <CardTitle className="text-2xl font-black flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
              CV Generated Successfully!
            </CardTitle>
            <CardDescription>Review your information below</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            
            {/* CV Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border-2 border-black rounded-lg bg-gray-50">
                <p className="text-sm text-gray-600 mb-1">Name</p>
                <p className="font-bold">{cvData.fullName}</p>
              </div>
              <div className="p-4 border-2 border-black rounded-lg bg-gray-50">
                <p className="text-sm text-gray-600 mb-1">Email</p>
                <p className="font-bold">{cvData.email}</p>
              </div>
              <div className="p-4 border-2 border-black rounded-lg bg-gray-50">
                <p className="text-sm text-gray-600 mb-1">Phone</p>
                <p className="font-bold">{cvData.phone}</p>
              </div>
              <div className="p-4 border-2 border-black rounded-lg bg-gray-50">
                <p className="text-sm text-gray-600 mb-1">Location</p>
                <p className="font-bold">{cvData.location}</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 border-2 border-black rounded-lg">
                <p className="text-3xl font-black">{cvData.education?.length || 0}</p>
                <p className="text-sm text-gray-600">Education</p>
              </div>
              <div className="text-center p-4 border-2 border-black rounded-lg">
                <p className="text-3xl font-black">{cvData.experienceProjects?.length || 0}</p>
                <p className="text-sm text-gray-600">Experience</p>
              </div>
              <div className="text-center p-4 border-2 border-black rounded-lg">
                <p className="text-3xl font-black">
                  {Object.values(cvData.skills || {}).flat().length}
                </p>
                <p className="text-sm text-gray-600">Skills</p>
              </div>
            </div>

            {/* Transcript Preview */}
            {transcript && (
              <div className="p-4 border-2 border-black rounded-lg bg-blue-50">
                <p className="font-bold mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Transcript:
                </p>
                <p className="text-sm text-gray-700 italic line-clamp-3">{transcript}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button
                onClick={downloadPDF}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold"
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
              {orgSlug && (
                <Button
                  onClick={submitCV}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Submit to {orgSlug}
                </Button>
              )}
              <Button
                onClick={() => router.push(`/ai-builder?prefill=${encodeURIComponent(JSON.stringify(cvData))}`)}
                variant="outline"
                className="border-2 border-black font-bold"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Edit in Builder
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
