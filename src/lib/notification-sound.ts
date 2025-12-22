// Simple notification sound using Web Audio API
let audioContext: AudioContext | null = null;

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
};

export const playNotificationSound = () => {
  try {
    const ctx = getAudioContext();

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Pleasant notification tone
    oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
    oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.1); // E5 note
    
    oscillator.type = 'sine';

    // Quick fade in/out for a soft sound
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.2);
  } catch (error) {
    console.error('Error playing notification sound:', error);
  }
};

// Ding-ding bell sound for plan created confirmation
export const playDingDingSound = () => {
  try {
    const ctx = getAudioContext();

    // Create two dings with a short gap
    const playDing = (startTime: number, frequency: number) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Bell-like tone (higher frequency)
      oscillator.frequency.setValueAtTime(frequency, startTime);
      oscillator.type = 'sine';

      // Bell envelope - quick attack, longer decay
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.4, startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

      oscillator.start(startTime);
      oscillator.stop(startTime + 0.3);
    };

    // First ding
    playDing(ctx.currentTime, 1319); // E6 note
    // Second ding (slightly lower, after short pause)
    playDing(ctx.currentTime + 0.15, 1175); // D6 note

  } catch (error) {
    console.error('Error playing ding-ding sound:', error);
  }
};

// Cache for the welcome audio blob URL
let welcomeAudioUrl: string | null = null;
let welcomeAudioLoading = false;

// Play "Let's shake it! shake it!" female voice for new member celebration
export const playWelcomeVoice = async () => {
  try {
    // If already loading, skip
    if (welcomeAudioLoading) return;

    // If we have cached audio, play it
    if (welcomeAudioUrl) {
      const audio = new Audio(welcomeAudioUrl);
      audio.volume = 0.7;
      await audio.play();
      return;
    }

    // Fetch and cache the audio
    welcomeAudioLoading = true;
    
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-welcome`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Welcome audio request failed: ${response.status}`);
    }

    const audioBlob = await response.blob();
    welcomeAudioUrl = URL.createObjectURL(audioBlob);
    
    const audio = new Audio(welcomeAudioUrl);
    audio.volume = 0.7;
    await audio.play();
  } catch (error) {
    console.error("Error playing welcome voice:", error);
  } finally {
    welcomeAudioLoading = false;
  }
};
