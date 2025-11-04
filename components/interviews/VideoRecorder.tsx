'use client';

import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Video, Circle, Square, Upload, Loader2 } from 'lucide-react';

interface VideoRecorderProps {
  onRecordingComplete: (blob: Blob, duration: number) => void;
  timeLimitSeconds?: number;
  questionText: string;
}

export function VideoRecorder({ 
  onRecordingComplete, 
  timeLimitSeconds = 120,
  questionText 
}: VideoRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(timeLimitSeconds);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Request camera/mic access on mount
  useEffect(() => {
    requestMediaAccess();
    return () => {
      stopStream();
    };
  }, []);

  const requestMediaAccess = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('Error accessing media devices:', error);
      alert('Please allow camera and microphone access to record your interview.');
    }
  };

  const stopStream = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const startCountdown = () => {
    setCountdown(3);
    const countInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(countInterval);
          startRecording();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startRecording = () => {
    if (!stream) return;

    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9,opus'
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setRecordedBlob(blob);
      setIsPreviewing(true);
      
      // Calculate duration
      const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setRecordedDuration(duration);
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(100); // Collect data every 100ms
    startTimeRef.current = Date.now();
    setIsRecording(true);
    setTimeRemaining(timeLimitSeconds);

    // Start countdown timer
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          stopRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const retake = () => {
    setRecordedBlob(null);
    setIsPreviewing(false);
    setTimeRemaining(timeLimitSeconds);
    setCountdown(null);
    // Restart stream if needed
    if (!stream) {
      requestMediaAccess();
    } else if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  };

  const handleSubmit = () => {
    if (recordedBlob) {
      onRecordingComplete(recordedBlob, recordedDuration);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Show preview of recorded video
  useEffect(() => {
    if (isPreviewing && recordedBlob && videoRef.current) {
      const url = URL.createObjectURL(recordedBlob);
      videoRef.current.srcObject = null;
      videoRef.current.src = url;
      return () => URL.revokeObjectURL(url);
    }
  }, [isPreviewing, recordedBlob]);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      {/* Question */}
      <div className="bg-white border-[3px] border-black rounded-2xl p-6 shadow-[6px_6px_0_#111]">
        <h3 className="font-bold text-xl mb-2">Question:</h3>
        <p className="text-gray-700 text-lg">{questionText}</p>
      </div>

      {/* Video Preview */}
      <div className="relative bg-black rounded-2xl overflow-hidden aspect-video border-[3px] border-black shadow-[6px_6px_0_#111]">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={!isPreviewing}
          controls={isPreviewing}
          className="w-full h-full object-cover"
        />
        
        {/* Countdown Overlay */}
        {countdown !== null && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-white text-9xl font-bold animate-pulse">
              {countdown}
            </div>
          </div>
        )}

        {/* Recording Indicator */}
        {isRecording && (
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 text-white px-3 py-2 rounded-full">
            <Circle className="w-3 h-3 fill-current animate-pulse" />
            <span className="font-semibold">REC</span>
            <span className="font-mono">{formatTime(timeRemaining)}</span>
          </div>
        )}

        {/* Preview Label */}
        {isPreviewing && (
          <div className="absolute top-4 left-4 bg-blue-600 text-white px-3 py-2 rounded-full font-semibold">
            Preview - {formatTime(recordedDuration)}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-4">
        {!isRecording && !isPreviewing && (
          <Button
            onClick={startCountdown}
            size="lg"
            className="bg-red-600 hover:bg-red-700 text-white border-[3px] border-black shadow-[4px_4px_0_#111] hover:shadow-[2px_2px_0_#111] transition-all"
            disabled={!stream}
          >
            <Circle className="w-5 h-5 mr-2 fill-current" />
            Start Recording
          </Button>
        )}

        {isRecording && (
          <Button
            onClick={stopRecording}
            size="lg"
            className="bg-red-600 hover:bg-red-700 text-white border-[3px] border-black shadow-[4px_4px_0_#111]"
          >
            <Square className="w-5 h-5 mr-2" />
            Stop Recording
          </Button>
        )}

        {isPreviewing && (
          <>
            <Button
              onClick={retake}
              size="lg"
              className="bg-white hover:bg-gray-100 text-black border-[3px] border-black shadow-[4px_4px_0_#111] hover:shadow-[2px_2px_0_#111] transition-all"
            >
              <Video className="w-5 h-5 mr-2" />
              Retake
            </Button>
            <Button
              onClick={handleSubmit}
              size="lg"
              className="bg-green-600 hover:bg-green-700 text-white border-[3px] border-black shadow-[4px_4px_0_#111] hover:shadow-[2px_2px_0_#111] transition-all"
            >
              <Upload className="w-5 h-5 mr-2" />
              Submit Response
            </Button>
          </>
        )}
      </div>

      {/* Instructions */}
      {!isRecording && !isPreviewing && (
        <div className="text-center text-sm text-gray-600">
          <p>You have <strong>{formatTime(timeLimitSeconds)}</strong> to answer this question.</p>
          <p className="mt-1">Click "Start Recording" when you're ready. You'll have a 3-second countdown.</p>
        </div>
      )}
    </div>
  );
}
