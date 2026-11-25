// perf.js - lightweight rolling frame-time monitor with hysteresis-guarded
// adaptive quality tiers (pixel ratio + bloom toggle) to protect 60 FPS on iGPUs.

const SAMPLE_WINDOW = 45;
const DOWNGRADE_COOLDOWN = 2.0;
const UPGRADE_COOLDOWN = 6.0;

export const QUALITY_TIERS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

export function createPerfMonitor(renderer, fx, onResize) {
  let frames = 0;
  let accumTime = 0;
  let cooldown = 2.0;
  let tier = QUALITY_TIERS.HIGH;
  const nativeDpr = Math.min(window.devicePixelRatio || 1, 2);

  function applyTier(nextTier) {
    tier = nextTier;
    const targetDpr = tier === QUALITY_TIERS.HIGH
      ? nativeDpr
      : tier === QUALITY_TIERS.MEDIUM
        ? Math.min(nativeDpr, 1.25)
        : 1;
    renderer.setPixelRatio(targetDpr);
    renderer.setSize(window.innerWidth, window.innerHeight);
    fx.bloomPass.enabled = tier !== QUALITY_TIERS.LOW;
    if (typeof onResize === 'function') onResize();
  }

  function update(realDelta) {
    if (cooldown > 0) cooldown -= realDelta;
    frames += 1;
    accumTime += realDelta;
    if (frames < SAMPLE_WINDOW) return;

    const avgMs = (accumTime / frames) * 1000;
    frames = 0;
    accumTime = 0;

    if (cooldown > 0) return;

    if (avgMs > 30 && tier !== QUALITY_TIERS.LOW) {
      applyTier(tier === QUALITY_TIERS.HIGH ? QUALITY_TIERS.MEDIUM : QUALITY_TIERS.LOW);
      cooldown = DOWNGRADE_COOLDOWN;
    } else if (avgMs > 22 && tier === QUALITY_TIERS.HIGH) {
      applyTier(QUALITY_TIERS.MEDIUM);
      cooldown = DOWNGRADE_COOLDOWN;
    } else if (avgMs < 14 && tier !== QUALITY_TIERS.HIGH) {
      applyTier(tier === QUALITY_TIERS.LOW ? QUALITY_TIERS.MEDIUM : QUALITY_TIERS.HIGH);
      cooldown = UPGRADE_COOLDOWN;
    }
  }

  return {
    update,
    getTier: () => tier
  };
}
