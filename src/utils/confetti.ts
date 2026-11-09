import confetti from 'canvas-confetti';

export const triggerConfetti = () => {
  // Fire multiple bursts for celebration
  confetti({
    particleCount: 80,
    spread: 60,
    origin: { y: 0.75 },
    colors: ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'],
  });

  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
    });
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
    });
  }, 200);
};
