export type DeviceTier = 'mobile' | 'tablet' | 'desktop';

export interface DeviceProfile {
  tier: DeviceTier;
  dpr: number;
  isTouch: boolean;
  hardwareConcurrency: number;
  deviceMemoryGb: number;
  isLowPower: boolean;
  minScreenRadius: {
    focused: number;
    neighbor: number;
    default: number;
  };
  touchBonus: number;
  labelScaleMultiplier: number;
  minZoom: number;
}

export function detectDeviceTier(width: number): DeviceTier {
  if (width < 640) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

export function getDeviceProfile(windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1280): DeviceProfile {
  const isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  const tier = detectDeviceTier(windowWidth);
  const rawDpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
  const hardwareConcurrency = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) : 4;
  const deviceMemoryGb = typeof navigator !== 'undefined' ? ((navigator as any).deviceMemory || 8) : 8;
  const isLowPower = hardwareConcurrency <= 4 || deviceMemoryGb <= 4;

  let maxDpr = 1.5;
  if (tier === 'mobile') {
    maxDpr = isLowPower ? 1.25 : 1.5;
  } else if (tier === 'tablet') {
    maxDpr = isLowPower ? 1.35 : 1.5;
  } else if (tier === 'desktop') {
    maxDpr = isLowPower ? 1.35 : 1.5;
  }

  const dpr = Math.min(rawDpr, maxDpr);

  if (tier === 'mobile') {
    return {
      tier,
      dpr,
      isTouch,
      hardwareConcurrency,
      deviceMemoryGb,
      isLowPower,
      minScreenRadius: {
        focused: 8.5,
        neighbor: 6.5,
        default: 4.0,
      },
      touchBonus: 36,
      labelScaleMultiplier: 1.05,
      minZoom: 0.025,
    };
  }

  if (tier === 'tablet') {
    return {
      tier,
      dpr,
      isTouch,
      hardwareConcurrency,
      deviceMemoryGb,
      isLowPower,
      minScreenRadius: {
        focused: 8.0,
        neighbor: 6.0,
        default: 3.5,
      },
      touchBonus: 30,
      labelScaleMultiplier: 1.0,
      minZoom: 0.025,
    };
  }

  return {
    tier,
    dpr,
    isTouch,
    hardwareConcurrency,
    deviceMemoryGb,
    isLowPower,
    minScreenRadius: {
      focused: 7.0,
      neighbor: 5.0,
      default: 3.0,
    },
    touchBonus: 24,
    labelScaleMultiplier: 1.0,
    minZoom: 0.025,
  };
}

export function enforceOptimalDevicePixelRatio(): number {
  if (typeof window === 'undefined') return 1;
  const profile = getDeviceProfile(window.innerWidth);
  try {
    Object.defineProperty(window, 'devicePixelRatio', {
      get: () => profile.dpr,
      configurable: true,
    });
  } catch {
    return window.devicePixelRatio || 1;
  }
  return profile.dpr;
}
