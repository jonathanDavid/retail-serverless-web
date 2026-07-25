import { describe, expect, it } from 'vitest';
import { buildComparison, type PickupMetrics } from './optimizerCompare';

const WITHOUT: PickupMetrics = {
  routeKm: 18.4,
  itemCostCents: 9_500_000,
  storesUsed: 4,
  travelMinutes: 37,
  fitness: -12_000, // cost 12 000
};

const WITH: PickupMetrics = {
  routeKm: 9.2,
  itemCostCents: 8_700_000,
  storesUsed: 2,
  travelMinutes: 18,
  fitness: -9_000, // cost 9 000
};

describe('buildComparison', () => {
  it('computes per-metric deltas (negative = improvement)', () => {
    const c = buildComparison(WITHOUT, WITH);
    expect(c.routeKm.before).toBe(18.4);
    expect(c.routeKm.after).toBe(9.2);
    expect(c.routeKm.delta).toBeCloseTo(-9.2, 5);
    expect(c.routeKm.pct).toBeCloseTo(-50, 1);

    expect(c.storesUsed.delta).toBe(-2);
    expect(c.travelMinutes.delta).toBe(-19);
    expect(c.itemCostCents.delta).toBe(-800_000);
  });

  it('derives the overall optimization % from fitness (cost = -fitness)', () => {
    const c = buildComparison(WITHOUT, WITH);
    // (12000 - 9000) / 12000 = 25%
    expect(c.optimizationPct).toBe(25);
  });

  it('reports 0% when the GA could not improve the baseline', () => {
    const c = buildComparison(WITHOUT, WITHOUT);
    expect(c.optimizationPct).toBe(0);
    expect(c.routeKm.delta).toBe(0);
  });

  it('handles a degenerate zero-cost baseline without dividing by zero', () => {
    const zero: PickupMetrics = { ...WITHOUT, fitness: 0 };
    const c = buildComparison(zero, WITH);
    expect(c.optimizationPct).toBe(0);
  });

  it('pct is 0 when the before value is 0', () => {
    const before: PickupMetrics = { ...WITHOUT, storesUsed: 0 };
    const c = buildComparison(before, WITH);
    expect(c.storesUsed.pct).toBe(0);
  });

  it('rounds displayed values to sane precision', () => {
    const c = buildComparison(
      { ...WITHOUT, routeKm: 10.123456 },
      { ...WITH, routeKm: 7.987654 },
    );
    expect(c.routeKm.before).toBe(10.12);
    expect(c.routeKm.after).toBe(7.99);
  });
});
