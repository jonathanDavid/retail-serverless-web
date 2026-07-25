import { describe, expect, it } from 'vitest';
import type { OrderItem } from '@/domain/types';
import type { StoreDef, ProductDef } from './catalog';
import { type DemoWorld, type InventoryEntry } from './inventory';
import {
  buildScenario,
  hasOptimizationHeadroom,
  metricsForSelection,
  naiveBaseline,
  naiveSelection,
  storesForSku,
  unstockedSkus,
  type Selection,
} from './scenario';

/**
 * Fixture world with exact coordinates and stock so store assignment and route
 * maths are deterministic:
 *   near   (1, 0)  → 1.0 km        mid (0, 3) → 3.0 km        far (6, 8) → 10.0 km
 */
const STORES: StoreDef[] = [
  { id: 'near', name: 'Cercana', x: 1, y: 0, neighborhood: 'A' },
  { id: 'mid', name: 'Media', x: 0, y: 3, neighborhood: 'B' },
  { id: 'far', name: 'Lejana', x: 6, y: 8, neighborhood: 'C' },
];

const PRODUCTS: ProductDef[] = [
  { sku: 'P1', name: 'P1', category: 'Bebidas', basePriceCents: 100000, tier: 'staple' },
  { sku: 'P2', name: 'P2', category: 'Bebidas', basePriceCents: 200000, tier: 'common' },
];

/** Build a world from an explicit {storeId:sku -> {stock, priceCents}} map. */
function world(
  cells: Record<string, { stock: number; priceCents: number; reserved?: number }>,
): DemoWorld {
  const entries = new Map<string, InventoryEntry>();
  for (const [key, v] of Object.entries(cells)) {
    const [storeId, sku] = key.split(':') as [string, string];
    entries.set(key, {
      storeId,
      sku,
      stock: v.stock,
      reserved: v.reserved ?? 0,
      priceCents: v.priceCents,
    });
  }
  return { seed: 0, stores: STORES, products: PRODUCTS, entries };
}

function item(sku: string, qty: number): OrderItem {
  return { sku, name: sku, qty, unitPriceCents: 0 };
}

describe('buildScenario from a real order', () => {
  const w = world({
    'near:P1': { stock: 20, priceCents: 100000 },
    'mid:P1': { stock: 20, priceCents: 90000 },
    'near:P2': { stock: 5, priceCents: 210000 },
  });

  it('mirrors the order line items (sku + qty) as the shopping list', () => {
    const scenario = buildScenario(w, [item('P1', 3), item('P2', 2)]);
    expect(scenario.shoppingList).toEqual([
      { sku: 'P1', qty: 3 },
      { sku: 'P2', qty: 2 },
    ]);
    expect(scenario.customer).toEqual({ x: 0, y: 0 });
  });

  it('includes only stores that can supply an ordered sku, with their inventory', () => {
    const scenario = buildScenario(w, [item('P1', 3), item('P2', 2)]);
    // 'far' carries nothing relevant → excluded.
    expect(scenario.stores.map((s) => s.id).sort()).toEqual(['mid', 'near']);
    const near = scenario.stores.find((s) => s.id === 'near');
    expect(near?.inventory).toEqual([
      { sku: 'P1', priceCents: 100000, stock: 20 },
      { sku: 'P2', priceCents: 210000, stock: 5 },
    ]);
    // 'mid' only stocks P1.
    const mid = scenario.stores.find((s) => s.id === 'mid');
    expect(mid?.inventory).toEqual([{ sku: 'P1', priceCents: 90000, stock: 20 }]);
  });

  it('reports reserved-only or absent stock as unavailable', () => {
    const w2 = world({
      'near:P1': { stock: 5, reserved: 5, priceCents: 100000 }, // nothing sellable
      'mid:P1': { stock: 8, priceCents: 100000 },
    });
    const scenario = buildScenario(w2, [item('P1', 2)]);
    expect(scenario.stores.map((s) => s.id)).toEqual(['mid']);
    expect(unstockedSkus(scenario)).toEqual([]);
  });

  it('flags skus no store can supply', () => {
    const scenario = buildScenario(world({}), [item('P1', 1)]);
    expect(unstockedSkus(scenario)).toEqual(['P1']);
  });
});

describe('naive baseline = per-item nearest in-stock store', () => {
  it('sends each item to the nearest store stocking it, no consolidation', () => {
    const w = world({
      'near:P1': { stock: 20, priceCents: 100000 },
      'mid:P1': { stock: 20, priceCents: 90000 },
      'mid:P2': { stock: 20, priceCents: 200000 },
    });
    const scenario = buildScenario(w, [item('P1', 2), item('P2', 1)]);
    const sel = naiveSelection(scenario);
    // P1 nearest = near (1km) even though mid is cheaper; P2 only at mid.
    expect(sel.get('P1')).toBe('near');
    expect(sel.get('P2')).toBe('mid');
  });

  it('prefers a nearest store that covers the full qty', () => {
    const w = world({
      'near:P1': { stock: 1, priceCents: 100000 },
      'mid:P1': { stock: 20, priceCents: 100000 },
    });
    const scenario = buildScenario(w, [item('P1', 5)]);
    // near is closer but can't cover 5 → mid.
    expect(naiveSelection(scenario).get('P1')).toBe('mid');
  });

  it('computes route (nearest-neighbor + return) and item cost', () => {
    const w = world({
      'near:P1': { stock: 20, priceCents: 100000 },
      'mid:P2': { stock: 20, priceCents: 200000 },
    });
    const scenario = buildScenario(w, [item('P1', 2), item('P2', 1)]);
    const metrics = naiveBaseline(scenario);
    // route: customer→near(1) + near→mid(√10) + mid→customer(3)
    const expectedKm = 1 + Math.hypot(1, 3) + 3;
    expect(metrics.routeKm).toBeCloseTo(Math.round(expectedKm * 100) / 100, 2);
    expect(metrics.storesUsed).toBe(2);
    expect(metrics.itemCostCents).toBe(2 * 100000 + 1 * 200000);
    expect(metrics.travelMinutes).toBe(Math.round(expectedKm * 2)); // 30km/h
  });
});

describe('metricsForSelection (used for baseline and optimized alike)', () => {
  it('consolidating to one store shortens the route and drops stores', () => {
    const w = world({
      'near:P1': { stock: 20, priceCents: 100000 },
      'mid:P1': { stock: 20, priceCents: 100000 },
      'near:P2': { stock: 20, priceCents: 200000 },
      'mid:P2': { stock: 20, priceCents: 200000 },
    });
    const scenario = buildScenario(w, [item('P1', 1), item('P2', 1)]);

    const scattered: Selection = new Map([
      ['P1', 'near'],
      ['P2', 'mid'],
    ]);
    const consolidated: Selection = new Map([
      ['P1', 'near'],
      ['P2', 'near'],
    ]);

    const a = metricsForSelection(scenario, scattered);
    const b = metricsForSelection(scenario, consolidated);
    expect(b.storesUsed).toBeLessThan(a.storesUsed);
    expect(b.routeKm).toBeLessThan(a.routeKm);
  });
});

describe('optimization headroom detection', () => {
  it('has headroom when an item is available in ≥2 stores', () => {
    const w = world({
      'near:P1': { stock: 10, priceCents: 100000 },
      'mid:P1': { stock: 10, priceCents: 90000 },
    });
    const scenario = buildScenario(w, [item('P1', 2)]);
    expect(storesForSku(scenario, 'P1')).toHaveLength(2);
    expect(hasOptimizationHeadroom(scenario)).toBe(true);
  });

  it('is already optimal when every item is single-store', () => {
    const w = world({
      'near:P1': { stock: 10, priceCents: 100000 },
      'mid:P2': { stock: 10, priceCents: 200000 },
    });
    // P1 only at near, P2 only at mid — no alternatives to consolidate.
    const scenario = buildScenario(w, [item('P1', 1), item('P2', 1)]);
    expect(hasOptimizationHeadroom(scenario)).toBe(false);
  });
});
