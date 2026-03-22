import confetti from "canvas-confetti";

export const triggerConfettiWaterfall = () => {
  const duration = 3000;
  const animationEnd = Date.now() + duration;
  const defaults = { 
    startVelocity: 30, 
    spread: 360, 
    ticks: 60, 
    zIndex: 9999,
    colors: ['#FF6B35', '#00CED1', '#9B59B6', '#F4D03F', '#2ECC71']
  };

  const randomInRange = (min: number, max: number) => {
    return Math.random() * (max - min) + min;
  };

  const interval: ReturnType<typeof setInterval> = setInterval(() => {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    const particleCount = 50 * (timeLeft / duration);

    // Confetti from the top, falling down like a waterfall
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: 0 },
      gravity: 1.2,
      drift: randomInRange(-0.5, 0.5),
    });
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: 0 },
      gravity: 1.2,
      drift: randomInRange(-0.5, 0.5),
    });
    confetti({
      ...defaults,
      particleCount: particleCount / 2,
      origin: { x: randomInRange(0.4, 0.6), y: 0 },
      gravity: 1.2,
      drift: randomInRange(-0.5, 0.5),
    });
  }, 150);
};

/** Subtle grey/silver confetti for premium “unlock” screens (monochrome). */
export const triggerConfettiWaterfallMonochrome = () => {
  const duration = 2800;
  const animationEnd = Date.now() + duration;
  const colors = [
    "#3a3a3a",
    "#4a4a4a",
    "#5a5a5a",
    "#6a6a6a",
    "#7a7a7a",
    "#8a8a8a",
    "#9a9a9a",
    "#a8a8a8",
    "#b8b8b8",
  ];
  const defaults = {
    startVelocity: 18,
    spread: 320,
    ticks: 90,
    zIndex: 9999,
    colors,
    gravity: 0.95,
    scalar: 0.55,
    decay: 0.92,
  };

  const randomInRange = (min: number, max: number) => {
    return Math.random() * (max - min) + min;
  };

  const interval: ReturnType<typeof setInterval> = setInterval(() => {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    const particleCount = 28 * (timeLeft / duration);

    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: 0 },
      drift: randomInRange(-0.35, 0.35),
    });
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: 0 },
      drift: randomInRange(-0.35, 0.35),
    });
    confetti({
      ...defaults,
      particleCount: particleCount * 0.45,
      origin: { x: randomInRange(0.42, 0.58), y: 0 },
      drift: randomInRange(-0.25, 0.25),
    });
  }, 180);
};
