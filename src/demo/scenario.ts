import type { OrderItem } from '@/domain/types';
import type { PickupMetrics } from '@/lib/optimizerCompare';
import { URBAN_SPEED_KMH } from './catalog';
import {
  entryKey,
  sellableUnits,
  type DemoWorld,
} from './inventory';

/**
 * The explicit pickup scenario sent to genetic-visualizer-api
 * (genetic/CONTRACT.md → "Custom scenario"), built from the REAL order and the
 * REAL store inventory — plus the local logic to compute the honest naive
 * baseline and to decide whether there is any optimization headroom at all.
 *
 * Coordinates are in km with the customer at the origin; travel time = distance
 * ÷ 30 km/h, matching the optimizer's own model so before/after are comparable.
 */

export interface ScenarioInventoryItem {
  sku: string;
  priceCents: number;
  /** Sellable units at this store (reserved units excluded). */
  stock: number;
}

export interface ScenarioStore {
  id: string;
  name: string;
  x: number;
  y: number;
  inventory: ScenarioInventoryItem[];
}

export interface ScenarioShoppingItem {
  sku: string;
  qty: number;
}

export interface PickupScenario {
  customer: { x: number; y: number };
  stores: ScenarioStore[];
  shoppingList: ScenarioShoppingItem[];
}

/** Selection of a supplying store per sku (the pickup genome, decoded). */
export type Selection = Map<string, string>;

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Build the scenario from the order's line items against the current world.
 * Includes every store that carries at least one ordered sku with sellable
 * stock (relevant stores + their alternatives); each store's inventory is
 * restricted to the ordered skus it can actually supply.
 */
export function buildScenario(
  world: DemoWorld,
  items: readonly OrderItem[],
): PickupScenario {
  const skus = items.map((i) => i.sku);

  const stores: ScenarioStore[] = [];
  for (const store of world.stores) {
    const inventory: ScenarioInventoryItem[] = [];
    for (const sku of skus) {
      const entry = world.entries.get(entryKey(store.id, sku));
      if (!entry) continue;
      const stock = sellableUnits(entry);
      if (stock <= 0) continue;
      inventory.push({ sku, priceCents: entry.priceCents, stock });
    }
    if (inventory.length > 0) {
      stores.push({ id: store.id, name: store.name, x: store.x, y: store.y, inventory });
    }
  }

  return {
    customer: { x: 0, y: 0 },
    stores,
    shoppingList: items.map((i) => ({ sku: i.sku, qty: i.qty })),
  };
}

/** Skus in the shopping list that no store can supply (should be empty). */
export function unstockedSkus(scenario: PickupScenario): string[] {
  return scenario.shoppingList
    .map((i) => i.sku)
    .filter((sku) => !scenario.stores.some((s) => hasSku(s, sku)));
}

function hasSku(store: ScenarioStore, sku: string): boolean {
  return store.inventory.some((i) => i.sku === sku && i.stock > 0);
}

function priceAt(store: ScenarioStore, sku: string): number | null {
  const item = store.inventory.find((i) => i.sku === sku);
  return item ? item.priceCents : null;
}

/** Stores (with sellable stock) that can supply a given sku. */
export function storesForSku(
  scenario: PickupScenario,
  sku: string,
): ScenarioStore[] {
  return scenario.stores.filter((s) => hasSku(s, sku));
}

/**
 * Optimization headroom exists only if at least one item is available in ≥2
 * stores — otherwise every choice is forced and the plan is already optimal.
 */
export function hasOptimizationHeadroom(scenario: PickupScenario): boolean {
  return scenario.shoppingList.some(
    (item) => storesForSku(scenario, item.sku).length >= 2,
  );
}

/**
 * Naive "sin optimizar" plan: assign each item to its individually-nearest
 * in-stock store, with NO consolidation. This is the honest before-state a
 * shopper would get picking each product at whichever store is closest.
 */
export function naiveSelection(scenario: PickupScenario): Selection {
  const selection: Selection = new Map();
  for (const item of scenario.shoppingList) {
    const candidates = storesForSku(scenario, item.sku);
    if (candidates.length === 0) continue;
    // Nearest store to the customer; prefer one that covers the full qty.
    const sorted = [...candidates].sort(
      (a, b) => dist(scenario.customer, a) - dist(scenario.customer, b),
    );
    const covering = sorted.find(
      (s) => (s.inventory.find((i) => i.sku === item.sku)?.stock ?? 0) >= item.qty,
    );
    selection.set(item.sku, (covering ?? sorted[0]!).id);
  }
  return selection;
}

/**
 * Metrics for a selection under the shared model: item cost from the chosen
 * store's price, route as nearest-neighbor over the used stores (customer →
 * … → customer), travel time at 30 km/h. Used for BOTH the naive baseline and
 * (from the GA's returned selection) the optimized plan, so the two are
 * measured identically.
 */
export function metricsForSelection(
  scenario: PickupScenario,
  selection: Selection,
): PickupMetrics {
  const storeById = new Map(scenario.stores.map((s) => [s.id, s]));

  // Item cost.
  let itemCostCents = 0;
  for (const item of scenario.shoppingList) {
    const storeId = selection.get(item.sku);
    const store = storeId ? storeById.get(storeId) : undefined;
    const price = store ? priceAt(store, item.sku) : null;
    if (price !== null) itemCostCents += item.qty * price;
  }

  // Route over the distinct used stores, nearest-neighbor from the customer.
  const usedIds = [...new Set(selection.values())];
  const toVisit = new Set(usedIds);
  let cursor = scenario.customer;
  let routeKm = 0;
  while (toVisit.size > 0) {
    let best: ScenarioStore | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (const id of toVisit) {
      const store = storeById.get(id);
      if (!store) {
        toVisit.delete(id);
        continue;
      }
      const d = dist(cursor, store);
      if (d < bestD) {
        bestD = d;
        best = store;
      }
    }
    if (!best) break;
    toVisit.delete(best.id);
    routeKm += bestD;
    cursor = best;
  }
  if (usedIds.length > 0) routeKm += dist(cursor, scenario.customer);

  return {
    routeKm: round2(routeKm),
    itemCostCents,
    storesUsed: usedIds.length,
    travelMinutes: Math.round((routeKm / URBAN_SPEED_KMH) * 60),
  };
}

/** The naive baseline metrics for a scenario (per-item nearest, no merging). */
export function naiveBaseline(scenario: PickupScenario): PickupMetrics {
  return metricsForSelection(scenario, naiveSelection(scenario));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
