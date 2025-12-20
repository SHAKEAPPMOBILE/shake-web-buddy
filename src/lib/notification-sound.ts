// Simple notification sound using Web Audio API
let audioContext: AudioContext | null = null;

export const playNotificationSound = () => {
  try {
    // Create AudioContext lazily (requires user interaction first)
    if (!audioContext) {
      audioContext = new AudioContext();
    }

    // Resume if suspended (browsers require user interaction)
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Pleasant notification tone
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5 note
    oscillator.frequency.setValueAtTime(660, audioContext.currentTime + 0.1); // E5 note
    
    oscillator.type = 'sine';

    // Quick fade in/out for a soft sound
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.02);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch (error) {
    console.error('Error playing notification sound:', error);
  }
};
