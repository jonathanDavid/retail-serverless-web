import { describe, expect, it } from 'vitest';
import { KM_COST_CENTS, STOP_PENALTY_CENTS } from '@/demo/catalog';
import {
  buildComparison,
  fuelCostCents,
  totalCostCents,
  type PickupMetrics,
} from './optimizerCompare';

// Naive plan: 4 stores, long scattered route, slightly cheaper items.
const WITHOUT: PickupMetrics = {
  routeKm: 18.4,
  itemCostCents: 9_500_000,
  storesUsed: 4,
  travelMinutes: 37,
};

// Optimized plan: consolidated to 2 stores, half the route, marginally pricier.
const WITH: PickupMetrics = {
  routeKm: 9.2,
  itemCostCents: 8_700_000,
  storesUsed: 2,
  travelMinutes: 18,
};

describe('cost model', () => {
  it('folds fuel and per-stop penalty into the item cost', () => {
    // 9_500_000 + 18.4*200000 + 4*500000 = 15_180_000
    expect(totalCostCents(WITHOUT)).toBe(
      9_500_000 + 18.4 * KM_COST_CENTS + 4 * STOP_PENALTY_CENTS,
    );
    expect(totalCostCents(WITHOUT)).toBe(15_180_000);
    expect(totalCostCents(WITH)).toBe(11_540_000);
  });

  it('reports the fuel component alone', () => {
    expect(fuelCostCents(WITHOUT)).toBe(Math.round(18.4 * KM_COST_CENTS));
  });
});

describe('buildComparison', () => {
  it('computes per-metric deltas (negative = improvement)', () => {
    const c = buildComparison(WITHOUT, WITH);
    expect(c.routeKm.delta).toBeCloseTo(-9.2, 5);
    expect(c.storesUsed.delta).toBe(-2);
    expect(c.travelMinutes.delta).toBe(-19);
    expect(c.itemCostCents.delta).toBe(-800_000);
    expect(c.totalCostCents.before).toBe(15_180_000);
    expect(c.totalCostCents.after).toBe(11_540_000);
    expect(c.totalCostCents.delta).toBe(-3_640_000);
  });

  it('derives the headline % from TOTAL cost, not item price', () => {
    const c = buildComparison(WITHOUT, WITH);
    // 3_640_000 / 15_180_000 = 23.98%
    expect(c.optimizationPct).toBeCloseTo(23.98, 2);
    // Item price alone barely moved (~8.4%), so the headline is the fuller story.
    expect(Math.abs(c.itemCostCents.pct)).toBeLessThan(c.optimizationPct + 5);
  });

  it('never reports a negative saving (clamped at 0)', () => {
    const c = buildComparison(WITHOUT, WITHOUT);
    expect(c.optimizationPct).toBe(0);
    // A GA plan that is somehow worse still reports 0, not a negative headline.
    const worse: PickupMetrics = { ...WITHOUT, routeKm: 25, storesUsed: 5 };
    expect(buildComparison(WITHOUT, worse).optimizationPct).toBe(0);
  });

  it('shows a real non-zero saving when there is headroom to consolidate', () => {
    const c = buildComparison(WITHOUT, WITH);
    expect(c.optimizationPct).toBeGreaterThan(0);
    expect(c.storesUsed.delta).toBeLessThan(0);
    expect(c.routeKm.delta).toBeLessThan(0);
  });

  it('pct is 0 when the before value is 0', () => {
    const before: PickupMetrics = { ...WITHOUT, storesUsed: 0 };
    expect(buildComparison(before, WITH).storesUsed.pct).toBe(0);
  });
});
