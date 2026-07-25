import { describe, expect, it } from 'vitest';
import { DEMO_PRODUCTS, DEMO_STORES } from './catalog';
import {
  aggregateStatus,
  bestPriceCents,
  entryKey,
  generateWorld,
  LOW_STOCK_THRESHOLD,
  sellableUnits,
  stockStatus,
  storesCarrying,
  totalSellable,
  type InventoryEntry,
} from './inventory';

function entry(partial: Partial<InventoryEntry>): InventoryEntry {
  return {
    storeId: 's1',
    sku: 'SKU-X',
    stock: 0,
    reserved: 0,
    priceCents: 100000,
    ...partial,
  };
}

describe('generateWorld determinism', () => {
  it('produces identical worlds for the same seed', () => {
    const a = generateWorld(1234);
    const b = generateWorld(1234);
    expect(a.entries.size).toBe(b.entries.size);
    for (const [key, entryA] of a.entries) {
      expect(b.entries.get(key)).toEqual(entryA);
    }
  });

  it('produces different worlds for different seeds', () => {
    const a = generateWorld(1);
    const b = generateWorld(2);
    let differences = 0;
    for (const [key, entryA] of a.entries) {
      const entryB = b.entries.get(key);
      if (!entryB) continue;
      if (entryB.stock !== entryA.stock || entryB.priceCents !== entryA.priceCents) {
        differences += 1;
      }
    }
    expect(differences).toBeGreaterThan(0);
  });

  it('emits only sane, sparse cells (a product may be absent from a store)', () => {
    const world = generateWorld(99);
    // Sparse: entries are only for carried store×product pairs.
    expect(world.entries.size).toBeLessThanOrEqual(
      DEMO_STORES.length * DEMO_PRODUCTS.length,
    );
    expect(world.entries.size).toBeGreaterThan(0);
    for (const e of world.entries.values()) {
      expect(e.stock).toBeGreaterThanOrEqual(0);
      expect(e.reserved).toBeGreaterThanOrEqual(0);
      expect(e.reserved).toBeLessThanOrEqual(e.stock);
      expect(Number.isInteger(e.priceCents)).toBe(true);
      expect(e.priceCents).toBeGreaterThan(0);
      // Prices snap to 50-peso steps (5000 cents).
      expect(e.priceCents % 5000).toBe(0);
    }
  });
});

describe('inventory distributes overlapping items across stores (headroom)', () => {
  it('carries every product in at least one store', () => {
    const world = generateWorld(2026);
    for (const product of DEMO_PRODUCTS) {
      expect(storesCarrying(world, product.sku).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('stocks staples across multiple stores so orders can span alternatives', () => {
    const world = generateWorld(2026);
    const staples = DEMO_PRODUCTS.filter((p) => p.tier === 'staple');
    // Most staples should be carried by ≥2 stores — that spread is the headroom
    // the optimizer needs. (Averaged over the tier to stay robust to any one roll.)
    const multiStore = staples.filter(
      (p) => storesCarrying(world, p.sku).length >= 2,
    );
    expect(multiStore.length).toBeGreaterThanOrEqual(
      Math.ceil(staples.length * 0.6),
    );
  });

  it('keeps niche products narrow (1-2 stores)', () => {
    const world = generateWorld(2026);
    for (const product of DEMO_PRODUCTS.filter((p) => p.tier === 'niche')) {
      expect(storesCarrying(world, product.sku).length).toBeLessThanOrEqual(2);
    }
  });
});

describe('stockStatus thresholds', () => {
  it('flags empty shelves as out', () => {
    expect(stockStatus(entry({ stock: 0 }))).toBe('out');
  });

  it('flags fully-reserved stock as reserved', () => {
    expect(stockStatus(entry({ stock: 8, reserved: 8 }))).toBe('reserved');
  });

  it('flags sellable ≤ threshold (10) as low — boundary inclusive', () => {
    expect(stockStatus(entry({ stock: LOW_STOCK_THRESHOLD }))).toBe('low');
    expect(stockStatus(entry({ stock: 1 }))).toBe('low');
    expect(stockStatus(entry({ stock: 15, reserved: 5 }))).toBe('low'); // sellable 10
  });

  it('flags sellable above threshold as available', () => {
    expect(stockStatus(entry({ stock: LOW_STOCK_THRESHOLD + 1 }))).toBe(
      'available',
    );
    expect(stockStatus(entry({ stock: 60 }))).toBe('available');
  });
});

describe('aggregateStatus across stores', () => {
  it('is out when every store is empty', () => {
    expect(
      aggregateStatus([entry({ stock: 0 }), entry({ stock: 0, storeId: 's2' })]),
    ).toBe('out');
  });

  it('is reserved when stock exists but nothing is sellable', () => {
    expect(
      aggregateStatus([
        entry({ stock: 4, reserved: 4 }),
        entry({ stock: 0, storeId: 's2' }),
      ]),
    ).toBe('reserved');
  });

  it('is low when total sellable is at or under the threshold', () => {
    expect(
      aggregateStatus([
        entry({ stock: 6 }),
        entry({ stock: 4, storeId: 's2' }),
      ]),
    ).toBe('low');
  });

  it('is available when the network has plenty', () => {
    expect(
      aggregateStatus([
        entry({ stock: 6 }),
        entry({ stock: 30, storeId: 's2' }),
      ]),
    ).toBe('available');
  });
});

describe('derived helpers', () => {
  it('sellableUnits never goes negative', () => {
    expect(sellableUnits(entry({ stock: 3, reserved: 5 }))).toBe(0);
  });

  it('bestPriceCents picks the cheapest sellable store', () => {
    const world = generateWorld(7);
    const sku = DEMO_PRODUCTS[0]!.sku;
    const best = bestPriceCents(world, sku);
    if (best !== null) {
      expect(totalSellable(world, sku)).toBeGreaterThan(0);
      for (const store of DEMO_STORES) {
        const e = world.entries.get(entryKey(store.id, sku));
        if (e && sellableUnits(e) > 0) {
          expect(best).toBeLessThanOrEqual(e.priceCents);
        }
      }
    }
  });
});
