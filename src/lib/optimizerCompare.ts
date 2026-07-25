import { KM_COST_CENTS, STOP_PENALTY_CENTS } from '@/demo/catalog';

/**
 * Pure comparison math for the pickup-optimizer integration.
 *
 * Both sides are measured with the SAME cost model so the headline saving is
 * honest and meaningful. Item price barely changes between plans (the same
 * goods are bought); the real win is fewer stores and a shorter route, so the
 * total cost folds route fuel and per-stop overhead into the item cost:
 *
 *   totalCost = itemCost + routeKm · kmCost + storesUsed · stopPenalty
 *
 * WITHOUT = the naive per-item-nearest plan (computed locally from the real
 * scenario); WITH = the GA's final `done` renderSpec. The optimization % is the
 * saving on total cost, not on item price alone.
 */

/** Metrics of one pickup solution, mirroring the pickup `renderSpec`. */
export interface PickupMetrics {
  routeKm: number;
  itemCostCents: number;
  storesUsed: number;
  travelMinutes: number;
}

/** Total cost of a plan in integer COP cents under the shared cost model. */
export function totalCostCents(m: PickupMetrics): number {
  return Math.round(
    m.itemCostCents +
      m.routeKm * KM_COST_CENTS +
      m.storesUsed * STOP_PENALTY_CENTS,
  );
}

/** Route fuel component only, integer COP cents. */
export function fuelCostCents(m: PickupMetrics): number {
  return Math.round(m.routeKm * KM_COST_CENTS);
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
  totalCostCents: MetricDelta;
  /** Headline saving on TOTAL cost, as a positive percentage (0 if no gain). */
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

/** Build the WITHOUT vs WITH comparison from two real plans. */
export function buildComparison(
  before: PickupMetrics,
  after: PickupMetrics,
): OptimizationComparison {
  const totalBefore = totalCostCents(before);
  const totalAfter = totalCostCents(after);
  const optimizationPct =
    totalBefore <= 0
      ? 0
      : Math.max(0, round2(((totalBefore - totalAfter) / totalBefore) * 100));

  return {
    routeKm: delta(round2(before.routeKm), round2(after.routeKm)),
    travelMinutes: delta(
      Math.round(before.travelMinutes),
      Math.round(after.travelMinutes),
    ),
    storesUsed: delta(before.storesUsed, after.storesUsed),
    itemCostCents: delta(before.itemCostCents, after.itemCostCents),
    totalCostCents: delta(totalBefore, totalAfter),
    optimizationPct,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
