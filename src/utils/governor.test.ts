import { describe, it, expect } from 'vitest';
import { AdaptivePerformanceGovernor } from './governor';

describe('Adaptive Performance Governor', () => {
  it('initializes with ultra tier and full visual fidelity', () => {
    const governor = new AdaptivePerformanceGovernor();
    const profile = governor.getProfile();
    expect(profile.tier).toBe('ultra');
    expect(profile.particleBudget).toBe(2);
    expect(profile.labelStride).toBe(1);
    expect(profile.enableAuraRings).toBe(true);
  });

  it('downgrades smoothly under sustained heavy load', () => {
    const governor = new AdaptivePerformanceGovernor('ultra');
    let time = 1000;

    for (let i = 0; i < 25; i++) {
      governor.recordFrame(35, time);
      time += 35;
    }
    expect(governor.getTier()).toBe('balanced');
    expect(governor.getProfile().particleBudget).toBe(1);

    time += 3500;
    for (let i = 0; i < 25; i++) {
      governor.recordFrame(35, time);
      time += 35;
    }
    expect(governor.getTier()).toBe('performance');
    expect(governor.getProfile().particleBudget).toBe(0);
    expect(governor.getProfile().enableAuraRings).toBe(false);

    time += 3500;
    for (let i = 0; i < 50; i++) {
      governor.recordFrame(100, time);
      time += 100;
    }
    expect(governor.getTier()).toBe('performance');
    expect(governor.getProfile().particleBudget).toBe(0);
  });

  it('recovers to ultra tier under sustained headroom', () => {
    const governor = new AdaptivePerformanceGovernor('performance');
    let time = 1000;

    for (let i = 0; i < 25; i++) {
      governor.recordFrame(5, time);
      time += 5;
    }
    expect(governor.getTier()).toBe('balanced');

    time += 3500;
    for (let i = 0; i < 25; i++) {
      governor.recordFrame(5, time);
      time += 5;
    }
    expect(governor.getTier()).toBe('ultra');
    expect(governor.getProfile().particleBudget).toBe(2);
    expect(governor.getProfile().enableAuraRings).toBe(true);

    time += 3500;
    for (let i = 0; i < 50; i++) {
      governor.recordFrame(2, time);
      time += 2;
    }
    expect(governor.getTier()).toBe('ultra');
  });

  it('respects hysteresis to prevent rapid flapping', () => {
    const governor = new AdaptivePerformanceGovernor('ultra');
    let time = 1000;

    for (let i = 0; i < 25; i++) {
      governor.recordFrame(35, time);
      time += 35;
    }
    expect(governor.getTier()).toBe('balanced');

    for (let i = 0; i < 25; i++) {
      governor.recordFrame(35, time);
      time += 35;
    }
    expect(governor.getTier()).toBe('balanced');
  });

  it('notifies subscribers upon tier changes', () => {
    const governor = new AdaptivePerformanceGovernor('ultra');
    let notifiedTier = '';
    const unsubscribe = governor.subscribe((profile) => {
      notifiedTier = profile.tier;
    });

    let time = 1000;
    for (let i = 0; i < 25; i++) {
      governor.recordFrame(35, time);
      time += 35;
    }
    expect(notifiedTier).toBe('balanced');
    unsubscribe();
  });

  it('resets to ultra tier upon zoom gesture', () => {
    const governor = new AdaptivePerformanceGovernor('ultra');
    let time = 1000;
    for (let i = 0; i < 50; i++) {
      governor.recordFrame(40, time);
      time += 40;
    }
    expect(governor.getTier()).toBe('balanced');

    governor.resetOnZoom(time + 100);
    expect(governor.getTier()).toBe('ultra');
    expect(governor.getProfile().particleBudget).toBe(2);
    expect(governor.getProfile().enableAuraRings).toBe(true);
  });
});
