import * as faceapi from '@vladmandic/face-api';
import { supabase } from '@/integrations/supabase/client';

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';

export async function loadModels(): Promise<void> {
  try {
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    console.log('Face API models loaded successfully');
  } catch (error) {
    console.error('Error loading face API models:', error);
    throw error;
  }
}

export async function captureFaceDescriptor(videoElement: HTMLVideoElement): Promise<Float32Array | null> {
  try {
    const detection = await faceapi
      .detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (detection) {
      return detection.descriptor;
    }
    return null;
  } catch (error) {
    console.error('Error capturing face descriptor:', error);
    return null;
  }
}

export function compareFaces(stored: number[], live: Float32Array): boolean {
  const distance = faceapi.euclideanDistance(stored, live);
  return distance < 0.5;
}

export async function storeFaceDescriptor(userId: string, descriptor: Float32Array): Promise<void> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        face_descriptor: Array.from(descriptor),
        face_auth_enabled: true,
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Error storing face descriptor:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error storing face descriptor:', error);
    throw error;
  }
}

export async function getFaceDescriptor(userId: string): Promise<number[] | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('face_descriptor')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching face descriptor:', error);
      return null;
    }

    return data?.face_descriptor as number[] | null;
  } catch (error) {
    console.error('Error fetching face descriptor:', error);
    return null;
  }
}