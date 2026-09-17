export type QualityTier = 'performance' | 'balanced' | 'ultra';

export interface QualityProfile {
  tier: QualityTier;
  particleBudget: number;
  labelStride: number;
  enableAuraRings: boolean;
}

const TIER_PROFILES: Record<QualityTier, QualityProfile> = {
  performance: {
    tier: 'performance',
    particleBudget: 0,
    labelStride: 3,
    enableAuraRings: false,
  },
  balanced: {
    tier: 'balanced',
    particleBudget: 1,
    labelStride: 2,
    enableAuraRings: true,
  },
  ultra: {
    tier: 'ultra',
    particleBudget: 2,
    labelStride: 1,
    enableAuraRings: true,
  },
};

export class AdaptivePerformanceGovernor {
  private currentTier: QualityTier;
  private frameTimes: number[];
  private maxSamples: number;
  private lastTierChangeTime: number;
  private hysteresisMs: number;
  private downgradeThresholdMs: number;
  private upgradeThresholdMs: number;
  private listeners: Set<(profile: QualityProfile) => void>;

  constructor(initialTier: QualityTier = 'ultra') {
    this.currentTier = initialTier;
    this.frameTimes = [];
    this.maxSamples = 30;
    this.lastTierChangeTime = -3000;
    this.hysteresisMs = 3000;
    this.downgradeThresholdMs = 22;
    this.upgradeThresholdMs = 11;
    this.listeners = new Set();
  }

  getProfile(): QualityProfile {
    return TIER_PROFILES[this.currentTier];
  }

  getTier(): QualityTier {
    return this.currentTier;
  }

  setTier(tier: QualityTier): void {
    if (this.currentTier === tier) return;
    this.currentTier = tier;
    this.notify();
  }

  subscribe(listener: (profile: QualityProfile) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  recordFrame(deltaMs: number, nowMs = performance.now()): void {
    if (deltaMs <= 0 || deltaMs > 200) return;

    this.frameTimes.push(deltaMs);
    if (this.frameTimes.length > this.maxSamples) {
      this.frameTimes.shift();
    }

    if (this.frameTimes.length < 20) return;
    if (nowMs - this.lastTierChangeTime < this.hysteresisMs) return;

    let sum = 0;
    for (let i = 0; i < this.frameTimes.length; i++) {
      sum += this.frameTimes[i];
    }
    const avg = sum / this.frameTimes.length;

    if (avg > this.downgradeThresholdMs) {
      if (this.currentTier === 'ultra') {
        this.currentTier = 'balanced';
        this.lastTierChangeTime = nowMs;
        this.frameTimes = [];
        this.notify();
      } else if (this.currentTier === 'balanced') {
        this.currentTier = 'performance';
        this.lastTierChangeTime = nowMs;
        this.frameTimes = [];
        this.notify();
      }
    } else if (avg < this.upgradeThresholdMs) {
      if (this.currentTier === 'performance') {
        this.currentTier = 'balanced';
        this.lastTierChangeTime = nowMs;
        this.frameTimes = [];
        this.notify();
      } else if (this.currentTier === 'balanced') {
        this.currentTier = 'ultra';
        this.lastTierChangeTime = nowMs;
        this.frameTimes = [];
        this.notify();
      }
    }
  }

  resetOnZoom(nowMs = performance.now()): void {
    this.frameTimes = [];
    if (this.currentTier !== 'ultra') {
      this.currentTier = 'ultra';
      this.lastTierChangeTime = nowMs;
      this.notify();
    }
  }

  private notify(): void {
    const profile = this.getProfile();
    this.listeners.forEach((fn) => fn(profile));
  }
}
