import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogOverlay, DialogPortal } from '@/components/ui/dialog';
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
      <DialogPortal>
        <DialogOverlay className="bg-black/80" />
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="w-64 h-64 rounded-full border-4 border-white relative">
              <div className="absolute inset-2 rounded-full border border-white/50" />
            </div>
          </div>

          <div className="absolute bottom-24 left-0 right-0 text-center text-white">
            <p className="text-xl font-semibold bg-black/50 px-4 py-2 rounded-lg inline-block">
              {status}
            </p>
          </div>

          <button
            onClick={onCancel}
            className="absolute top-6 left-6 text-white"
            aria-label="Close Face Capture"
          >
            <X className="w-7 h-7" />
          </button>
        </div>
      </DialogPortal>
    </Dialog>
  );
}