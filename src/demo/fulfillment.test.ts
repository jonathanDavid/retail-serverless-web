import { describe, expect, it } from 'vitest';
import type { OrderItem } from '@/domain/types';
import type { ProductDef, StoreDef } from './catalog';
import { entryKey, type DemoWorld, type InventoryEntry } from './inventory';
import { distanceKm, planFulfillment, splitExplanation } from './fulfillment';

/**
 * Hand-built fixture world so store distances and stock are exact:
 *   near   at (1, 0)  → 1.0 km from the customer
 *   mid    at (0, 3)  → 3.0 km
 *   far    at (6, 8)  → 10.0 km
 */
const STORES: StoreDef[] = [
  { id: 'near', name: 'Tienda Cercana', x: 1, y: 0, neighborhood: 'A' },
  { id: 'mid', name: 'Tienda Media', x: 0, y: 3, neighborhood: 'B' },
  { id: 'far', name: 'Tienda Lejana', x: 6, y: 8, neighborhood: 'C' },
];

const PRODUCTS: ProductDef[] = [
  { sku: 'P1', name: 'Producto 1', category: 'Bebidas', basePriceCents: 100000, tier: 'staple' },
  { sku: 'P2', name: 'Producto 2', category: 'Bebidas', basePriceCents: 200000, tier: 'common' },
];

function world(
  stockMap: Record<string, { stock: number; reserved?: number }>,
): DemoWorld {
  const entries = new Map<string, InventoryEntry>();
  for (const store of STORES) {
    for (const product of PRODUCTS) {
      const key = entryKey(store.id, product.sku);
      const cfg = stockMap[key] ?? { stock: 0 };
      entries.set(key, {
        storeId: store.id,
        sku: product.sku,
        stock: cfg.stock,
        reserved: cfg.reserved ?? 0,
        priceCents: product.basePriceCents,
      });
    }
  }
  return { seed: 0, stores: STORES, products: PRODUCTS, entries };
}

function item(sku: string, qty: number): OrderItem {
  return { sku, name: sku, qty, unitPriceCents: 100000 };
}

describe('store assignment (nearest with stock)', () => {
  it('assigns a line to the nearest store that can cover it fully', () => {
    const w = world({
      'near:P1': { stock: 5 },
      'mid:P1': { stock: 50 },
    });
    const plan = planFulfillment(w, [item('P1', 3)]);
    expect(plan.lines[0]?.pieces).toEqual([
      { storeId: 'near', storeName: 'Tienda Cercana', qty: 3 },
    ]);
    expect(plan.lines[0]?.shortfall).toBe(0);
  });

  it('skips a nearer store without enough stock when a farther one covers all', () => {
    const w = world({
      'near:P1': { stock: 2 },
      'mid:P1': { stock: 10 },
    });
    const plan = planFulfillment(w, [item('P1', 5)]);
    expect(plan.lines[0]?.pieces).toEqual([
      { storeId: 'mid', storeName: 'Tienda Media', qty: 5 },
    ]);
  });

  it('ignores reserved units when picking a store', () => {
    const w = world({
      'near:P1': { stock: 10, reserved: 10 }, // nothing sellable
      'mid:P1': { stock: 10 },
    });
    const plan = planFulfillment(w, [item('P1', 4)]);
    expect(plan.lines[0]?.pieces[0]?.storeId).toBe('mid');
  });

  it('splits across nearest stores when no single store covers the qty', () => {
    const w = world({
      'near:P1': { stock: 2 },
      'mid:P1': { stock: 2 },
      'far:P1': { stock: 10 },
    });
    const plan = planFulfillment(w, [item('P1', 5)]);
    // No single store fits pass 1 except far; far covers all 5.
    expect(plan.lines[0]?.pieces).toEqual([
      { storeId: 'far', storeName: 'Tienda Lejana', qty: 5 },
    ]);

    // Now make even far insufficient → true split, nearest first.
    const w2 = world({
      'near:P1': { stock: 2 },
      'mid:P1': { stock: 2 },
      'far:P1': { stock: 2 },
    });
    const plan2 = planFulfillment(w2, [item('P1', 5)]);
    expect(plan2.lines[0]?.pieces).toEqual([
      { storeId: 'near', storeName: 'Tienda Cercana', qty: 2 },
      { storeId: 'mid', storeName: 'Tienda Media', qty: 2 },
      { storeId: 'far', storeName: 'Tienda Lejana', qty: 1 },
    ]);
    expect(plan2.lines[0]?.shortfall).toBe(0);
  });

  it('reports a shortfall when the whole network cannot cover a line', () => {
    const w = world({ 'near:P1': { stock: 1 } });
    const plan = planFulfillment(w, [item('P1', 4)]);
    expect(plan.lines[0]?.shortfall).toBe(3);
  });

  it('consumes stock across lines: a later line sees reduced availability', () => {
    const w = world({
      'near:P1': { stock: 3 },
      'mid:P1': { stock: 10 },
    });
    // First line eats all 3 near units; second must go to mid.
    const plan = planFulfillment(w, [item('P1', 3), item('P1', 2)]);
    expect(plan.lines[0]?.pieces[0]?.storeId).toBe('near');
    expect(plan.lines[1]?.pieces[0]?.storeId).toBe('mid');
  });
});

describe('route + travel time', () => {
  it('orders stops nearest-neighbor and includes the return leg', () => {
    const w = world({
      'near:P1': { stock: 10 },
      'mid:P2': { stock: 10 },
    });
    const plan = planFulfillment(w, [item('P1', 1), item('P2', 1)]);
    expect(plan.route.map((s) => s.storeId)).toEqual(['near', 'mid']);
    // customer→near (1) + near→mid (√(1+9)=√10) + mid→customer (3)
    const expectedKm = 1 + Math.hypot(1, 3) + 3;
    expect(plan.totalKm).toBeCloseTo(expectedKm, 1);
    // 30 km/h → minutes = km * 2
    expect(plan.travelMinutes).toBe(Math.round(expectedKm * 2));
  });

  it('produces an empty route for an unfulfillable order', () => {
    const w = world({});
    const plan = planFulfillment(w, [item('P1', 1)]);
    expect(plan.route).toEqual([]);
    expect(plan.totalKm).toBe(0);
    expect(plan.travelMinutes).toBe(0);
  });
});

describe('split explanation', () => {
  it('reads "Todo desde X" for single-store plans', () => {
    const w = world({ 'near:P1': { stock: 10 }, 'near:P2': { stock: 10 } });
    const plan = planFulfillment(w, [item('P1', 2), item('P2', 1)]);
    expect(splitExplanation(plan)).toBe('Todo desde Tienda Cercana.');
  });

  it('lists per-store contributions largest first for split plans', () => {
    const w = world({
      'near:P1': { stock: 10 },
      'mid:P2': { stock: 10 },
    });
    const plan = planFulfillment(w, [item('P1', 2), item('P2', 1)]);
    expect(splitExplanation(plan)).toBe(
      '2 artículos desde Tienda Cercana, 1 artículo desde Tienda Media',
    );
  });
});

describe('distanceKm', () => {
  it('is plain euclidean distance', () => {
    expect(distanceKm({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});
