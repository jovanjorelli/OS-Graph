import { describe, it, expect } from 'vitest';
import { detectDeviceTier, getDeviceProfile, enforceOptimalDevicePixelRatio } from './device';

describe('Device Tier & DPR Adaptation', () => {
  it('correctly classifies viewport widths into tiers', () => {
    expect(detectDeviceTier(390)).toBe('mobile');
    expect(detectDeviceTier(639)).toBe('mobile');
    expect(detectDeviceTier(640)).toBe('tablet');
    expect(detectDeviceTier(1023)).toBe('tablet');
    expect(detectDeviceTier(1024)).toBe('desktop');
    expect(detectDeviceTier(2560)).toBe('desktop');
  });

  it('provides tailored touch targets and radii across tiers', () => {
    const mobileProfile = getDeviceProfile(390);
    expect(mobileProfile.tier).toBe('mobile');
    expect(mobileProfile.touchBonus).toBe(36);
    expect(mobileProfile.minScreenRadius.focused).toBe(8.5);
    expect(mobileProfile.minZoom).toBe(0.025);
    expect(typeof mobileProfile.isLowPower).toBe('boolean');

    const desktopProfile = getDeviceProfile(1440);
    expect(desktopProfile.tier).toBe('desktop');
    expect(desktopProfile.touchBonus).toBe(24);
    expect(desktopProfile.minScreenRadius.focused).toBe(7.0);
    expect(desktopProfile.minZoom).toBe(0.025);
  });

  it('safely enforces optimal device pixel ratio without crashing', () => {
    const dpr = enforceOptimalDevicePixelRatio();
    expect(typeof dpr).toBe('number');
    expect(dpr).toBeGreaterThanOrEqual(1.0);
    expect(dpr).toBeLessThanOrEqual(2.0);
  });
});
