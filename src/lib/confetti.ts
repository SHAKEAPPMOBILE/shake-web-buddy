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
