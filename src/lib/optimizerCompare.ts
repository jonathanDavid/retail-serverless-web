/**
 * Pure comparison math for the optional genetic-optimizer integration.
 *
 * The pickup problem's renderSpec (genetic/CONTRACT.md v2) carries everything
 * we need per solution: route length, item cost, stores visited, travel time.
 * WITHOUT = the best genome of the initial (random) population — i.e. before
 * any optimization pressure; WITH = the final `done` solution. Both come from
 * the same run, so they share the exact same scenario/seed.
 */

/** Metrics of one pickup solution, mirroring the pickup `renderSpec`. */
export interface PickupMetrics {
  routeKm: number;
  itemCostCents: number;
  storesUsed: number;
  travelMinutes: number;
  /** GA fitness = -(routeKm*kmCost + itemCost + stops*penalty); higher is better. */
  fitness: number;
}

export interface MetricDelta {
  before: number;
  after: number;
  /** after - before (negative = improvement for cost-like metrics). */
  delta: number;
  /** Percent change relative to before; 0 when before is 0. */
  pct: number;
}

export interface OptimizationComparison {
  routeKm: MetricDelta;
  travelMinutes: MetricDelta;
  storesUsed: MetricDelta;
  itemCostCents: MetricDelta;
  /**
   * Overall optimization percentage derived from fitness. Fitness is the
   * negative total cost, so cost = -fitness and the improvement is
   * (costBefore - costAfter) / costBefore.
   */
  optimizationPct: number;
}

function delta(before: number, after: number): MetricDelta {
  const d = after - before;
  return {
    before,
    after,
    delta: round2(d),
    pct: before === 0 ? 0 : round2((d / Math.abs(before)) * 100),
  };
}

/** Build the WITHOUT vs WITH comparison from two solutions of the same run. */
export function buildComparison(
  before: PickupMetrics,
  after: PickupMetrics,
): OptimizationComparison {
  const costBefore = -before.fitness;
  const costAfter = -after.fitness;
  const optimizationPct =
    costBefore <= 0 ? 0 : round2(((costBefore - costAfter) / costBefore) * 100);

  return {
    routeKm: delta(round2(before.routeKm), round2(after.routeKm)),
    travelMinutes: delta(
      Math.round(before.travelMinutes),
      Math.round(after.travelMinutes),
    ),
    storesUsed: delta(before.storesUsed, after.storesUsed),
    itemCostCents: delta(before.itemCostCents, after.itemCostCents),
    optimizationPct,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
