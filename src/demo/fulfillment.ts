import type { OrderItem } from '@/domain/types';
import { URBAN_SPEED_KMH, type StoreDef } from './catalog';
import {
  entryKey,
  sellableUnits,
  type DemoWorld,
} from './inventory';

/**
 * Fulfillment planning: which store supplies each order line, how the order
 * splits across stores, and the pickup route with an estimated travel time.
 *
 * Assignment rule: each line goes to the NEAREST store (euclidean distance
 * from the customer at the origin) with enough sellable stock; if no single
 * store can cover the full quantity, the line splits across the nearest
 * stores that have any stock. The route visits the chosen stores in
 * nearest-neighbor order starting from the customer and returns home;
 * travel time = distance / 30 km/h urban speed — the same model the
 * genetic optimizer's pickup problem uses, so comparisons are apples-to-apples.
 */

export interface FulfillmentPiece {
  storeId: string;
  storeName: string;
  qty: number;
}

export interface FulfillmentLine {
  sku: string;
  name: string;
  qty: number;
  pieces: FulfillmentPiece[];
  /** Units the whole network could not cover (0 on a fulfillable cart). */
  shortfall: number;
}

export interface RouteStop {
  storeId: string;
  storeName: string;
  /** Distance travelled on the leg INTO this stop, km. */
  legKm: number;
}

export interface FulfillmentPlan {
  lines: FulfillmentLine[];
  /** Per-store item counts, largest first — drives the split explanation. */
  storeSummary: { storeId: string; storeName: string; items: number }[];
  /** Pickup route in visit order (customer → … → customer). */
  route: RouteStop[];
  /** Total route length including the return leg, km. */
  totalKm: number;
  /** Total travel time at urban speed, minutes. */
  travelMinutes: number;
}

export function distanceKm(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function storeDistanceFromCustomer(store: StoreDef): number {
  return distanceKm({ x: 0, y: 0 }, store);
}

/**
 * Plan fulfillment for a set of order items against the current world.
 * Pure: reads stock levels but never mutates the world. Consumption is
 * simulated against a local copy so successive lines see reduced stock.
 */
export function planFulfillment(
  world: DemoWorld,
  items: readonly OrderItem[],
): FulfillmentPlan {
  // Local sellable-units ledger so the plan is internally consistent.
  const ledger = new Map<string, number>();
  for (const [key, entry] of world.entries) {
    ledger.set(key, sellableUnits(entry));
  }

  const storesByDistance = [...world.stores].sort(
    (a, b) => storeDistanceFromCustomer(a) - storeDistanceFromCustomer(b),
  );

  const lines: FulfillmentLine[] = items.map((item) => {
    let remaining = item.qty;
    const pieces: FulfillmentPiece[] = [];

    // Pass 1: nearest store that can cover the WHOLE remaining quantity.
    for (const store of storesByDistance) {
      const key = entryKey(store.id, item.sku);
      const have = ledger.get(key) ?? 0;
      if (have >= remaining && remaining > 0) {
        pieces.push({ storeId: store.id, storeName: store.name, qty: remaining });
        ledger.set(key, have - remaining);
        remaining = 0;
        break;
      }
    }

    // Pass 2: split across nearest stores with any stock.
    if (remaining > 0) {
      for (const store of storesByDistance) {
        if (remaining <= 0) break;
        const key = entryKey(store.id, item.sku);
        const have = ledger.get(key) ?? 0;
        if (have <= 0) continue;
        const take = Math.min(have, remaining);
        pieces.push({ storeId: store.id, storeName: store.name, qty: take });
        ledger.set(key, have - take);
        remaining -= take;
      }
    }

    return {
      sku: item.sku,
      name: item.name,
      qty: item.qty,
      pieces,
      shortfall: remaining,
    };
  });

  // Split summary: item units per store, largest contribution first.
  const perStore = new Map<string, number>();
  for (const line of lines) {
    for (const piece of line.pieces) {
      perStore.set(piece.storeId, (perStore.get(piece.storeId) ?? 0) + piece.qty);
    }
  }
  const storeSummary = [...perStore.entries()]
    .map(([storeId, count]) => {
      const store = world.stores.find((s) => s.id === storeId);
      return {
        storeId,
        storeName: store?.name ?? storeId,
        items: count,
      };
    })
    .sort((a, b) => b.items - a.items);

  // Route: nearest-neighbor over the used stores, starting at the customer.
  const toVisit = new Set(perStore.keys());
  const route: RouteStop[] = [];
  let cursor = { x: 0, y: 0 };
  let totalKm = 0;

  while (toVisit.size > 0) {
    let best: StoreDef | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const storeId of toVisit) {
      const store = world.stores.find((s) => s.id === storeId);
      if (!store) {
        toVisit.delete(storeId);
        continue;
      }
      const d = distanceKm(cursor, store);
      if (d < bestDist) {
        bestDist = d;
        best = store;
      }
    }
    if (!best) break;
    toVisit.delete(best.id);
    route.push({ storeId: best.id, storeName: best.name, legKm: bestDist });
    totalKm += bestDist;
    cursor = { x: best.x, y: best.y };
  }

  // Return leg home.
  if (route.length > 0) {
    totalKm += distanceKm(cursor, { x: 0, y: 0 });
  }

  const travelMinutes = (totalKm / URBAN_SPEED_KMH) * 60;

  return {
    lines,
    storeSummary,
    route,
    totalKm: round2(totalKm),
    travelMinutes: Math.round(travelMinutes),
  };
}

/**
 * Human split explanation, e.g. "2 artículos desde Mercado Norte, 1 desde
 * SuperCosta Riomar". Single-store plans read "Todo desde X".
 */
export function splitExplanation(plan: FulfillmentPlan): string {
  const s = plan.storeSummary;
  if (s.length === 0) return 'Sin asignación de tiendas.';
  const first = s[0];
  if (s.length === 1 && first) return `Todo desde ${first.storeName}.`;
  return s
    .map(
      (entry) =>
        `${entry.items} ${
          entry.items === 1 ? 'artículo' : 'artículos'
        } desde ${entry.storeName}`,
    )
    .join(', ');
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
