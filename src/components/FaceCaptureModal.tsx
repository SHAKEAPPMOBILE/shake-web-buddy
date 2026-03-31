import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogOverlay } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { loadModels, captureFaceDescriptor } from '@/services/faceAuthService';

interface FaceCaptureModalProps {
  open: boolean;
  mode: 'enroll' | 'authenticate';
  onSuccess: (descriptor?: Float32Array) => void;
  onCancel: () => void;
}

export function FaceCaptureModal({
  open,
  mode,
  onSuccess,
  onCancel
}: FaceCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState('Position your face in the circle');
  const [isStable, setIsStable] = useState(false);
  const stableTimerRef = useRef<NodeJS.Timeout | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (open) {
      setStatus('Position your face in the circle');
      setIsStable(false);
      initializeCamera();
    } else {
      stopCamera();
      stopFaceDetection();
    }

    return () => {
      stopCamera();
      stopFaceDetection();
      if (stableTimerRef.current) {
        clearTimeout(stableTimerRef.current);
      }
    };
  }, [open]);

  const initializeCamera = async () => {
    try {
      await loadModels();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Start face detection once video is ready
        videoRef.current.onloadedmetadata = () => {
          startFaceDetection();
        };
      }
    } catch (error) {
      console.error('Error initializing camera:', error);
      setStatus('Camera access denied');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const startFaceDetection = () => {
    stopFaceDetection(); // Clear any existing interval

    const detectFace = async () => {
      if (!videoRef.current || !open) return;

      const descriptor = await captureFaceDescriptor(videoRef.current);

      if (descriptor) {
        if (!isStable) {
          setStatus('Hold still...');
          setIsStable(true);

          stableTimerRef.current = setTimeout(async () => {
            await handleCapture(descriptor);
          }, 1500);
        }
      } else {
        if (isStable) {
          setIsStable(false);
          setStatus('Position your face in the circle');
          if (stableTimerRef.current) {
            clearTimeout(stableTimerRef.current);
            stableTimerRef.current = null;
          }
        }
      }
    };

    detectionIntervalRef.current = setInterval(detectFace, 500);
  };

  const stopFaceDetection = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
  };

  const handleCapture = async (descriptor: Float32Array) => {
    stopFaceDetection();
    setStatus('Verified ✓');
    setTimeout(() => {
      onSuccess(descriptor);
    }, mode === 'enroll' ? 700 : 500);
  };

  return (
    <Dialog open={open} onOpenChange={() => onCancel()}>
      <DialogOverlay className="fixed inset-0 bg-black z-50" />
      <DialogContent className="fixed inset-0 z-50 p-0 bg-transparent border-0">
        {/* Video element covering full screen */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Circular guide */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-64 h-64 rounded-full border-4 border-white relative">
            {/* Inner circle for better visibility */}
            <div className="absolute inset-2 rounded-full border border-white/50" />
          </div>
        </div>

        {/* Status text */}
        <div className="absolute bottom-32 left-0 right-0 text-center">
          <p className="text-white text-xl font-semibold bg-black/50 px-4 py-2 rounded-lg inline-block">
            {status}
          </p>
        </div>

        {/* Cancel button */}
        <Button
          onClick={onCancel}
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 text-white hover:bg-white/20"
        >
          <X className="w-6 h-6" />
        </Button>
      </DialogContent>
    </Dialog>
  );
}