// Efecto decorativo al completar una cita. Nunca debe bloquear ni fallar el cobro.
export async function launchCompletionConfetti(button: HTMLButtonElement | null) {
  if (!button || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  try {
    const { default: confetti } = await import("canvas-confetti");
    const rect = button.getBoundingClientRect();
    const computedStyles = window.getComputedStyle(button);
    const brandColor =
      computedStyles.getPropertyValue("--color-brand-600").trim() || "#7C3AED";
    const origin = {
      x: (rect.left + rect.width / 2) / window.innerWidth,
      y: (rect.top + rect.height / 2) / window.innerHeight,
    };

    confetti({
      particleCount: 90,
      spread: 72,
      startVelocity: 38,
      gravity: 0.92,
      scalar: 0.82,
      ticks: 180,
      origin,
      colors: [brandColor, "#22C55E", "#38BDF8", "#FACC15", "#F472B6"],
      disableForReducedMotion: true,
      zIndex: 100,
    });
  } catch {
    // Completing the appointment must not depend on the decorative effect.
  }
}
