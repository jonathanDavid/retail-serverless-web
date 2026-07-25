import { mulberry32, randInt, type Rng } from '@/lib/rng';
import {
  DEMO_PRODUCTS,
  DEMO_STORES,
  type ProductDef,
  type StoreDef,
} from './catalog';

/**
 * Seeded inventory generator. Deterministic: the same seed always produces the
 * same world (per-store stock, prices, reservations), which is what the
 * determinism tests pin down and what makes "actualizar inventario" honest —
 * a new seed is a new world, the same seed is the same world.
 */

export const LOW_STOCK_THRESHOLD = 10;

export type StockStatus = 'available' | 'low' | 'out' | 'reserved';

/** One store × product cell of the inventory matrix. */
export interface InventoryEntry {
  storeId: string;
  sku: string;
  /** Units physically in the store. */
  stock: number;
  /** Units held for other customers; not sellable. */
  reserved: number;
  /** This store's price for the product, integer COP cents. */
  priceCents: number;
}

export interface DemoWorld {
  seed: number;
  stores: readonly StoreDef[];
  products: readonly ProductDef[];
  /** Keyed `${storeId}:${sku}`. */
  entries: Map<string, InventoryEntry>;
}

export function entryKey(storeId: string, sku: string): string {
  return `${storeId}:${sku}`;
}

/** Units actually sellable right now. */
export function sellableUnits(entry: InventoryEntry): number {
  return Math.max(0, entry.stock - entry.reserved);
}

/**
 * Status of a single store × product cell:
 *  - `out`       nothing on the shelf
 *  - `reserved`  stock exists but every unit is held for someone else
 *  - `low`       sellable units at or under the threshold (≤10)
 *  - `available` plenty to sell
 */
export function stockStatus(entry: InventoryEntry): StockStatus {
  if (entry.stock <= 0) return 'out';
  const sellable = sellableUnits(entry);
  if (sellable <= 0) return 'reserved';
  if (sellable <= LOW_STOCK_THRESHOLD) return 'low';
  return 'available';
}

/** Aggregate status across every store for one product (browser badge). */
export function aggregateStatus(entries: readonly InventoryEntry[]): StockStatus {
  if (entries.length === 0) return 'out';
  const totalStock = entries.reduce((n, e) => n + e.stock, 0);
  if (totalStock <= 0) return 'out';
  const totalSellable = entries.reduce((n, e) => n + sellableUnits(e), 0);
  if (totalSellable <= 0) return 'reserved';
  if (totalSellable <= LOW_STOCK_THRESHOLD) return 'low';
  return 'available';
}

function rollEntry(rng: Rng, store: StoreDef, product: ProductDef): InventoryEntry {
  // Price: base ± up to 12% per store, snapped to 50-peso steps.
  const jitter = 1 + (rng() * 2 - 1) * 0.12;
  const rawPesos = (product.basePriceCents / 100) * jitter;
  const pesos = Math.max(50, Math.round(rawPesos / 50) * 50);

  // Stock distribution: ~12% empty shelves, ~18% low, the rest healthy.
  const roll = rng();
  let stock: number;
  if (roll < 0.12) stock = 0;
  else if (roll < 0.3) stock = randInt(rng, 1, LOW_STOCK_THRESHOLD);
  else stock = randInt(rng, LOW_STOCK_THRESHOLD + 5, 80);

  // ~10% of stocked cells have every unit reserved for other customers.
  const reserved = stock > 0 && rng() < 0.1 ? stock : 0;

  return {
    storeId: store.id,
    sku: product.sku,
    stock,
    reserved,
    priceCents: pesos * 100,
  };
}

/** Build the full demo world from a seed. Pure and deterministic. */
export function generateWorld(seed: number): DemoWorld {
  const rng = mulberry32(seed);
  const entries = new Map<string, InventoryEntry>();

  for (const store of DEMO_STORES) {
    for (const product of DEMO_PRODUCTS) {
      entries.set(entryKey(store.id, product.sku), rollEntry(rng, store, product));
    }
  }

  return { seed, stores: DEMO_STORES, products: DEMO_PRODUCTS, entries };
}

/** All entries for one product across stores. */
export function entriesForSku(world: DemoWorld, sku: string): InventoryEntry[] {
  return world.stores
    .map((store) => world.entries.get(entryKey(store.id, sku)))
    .filter((e): e is InventoryEntry => e !== undefined);
}

/** Cheapest sellable price for a product, or null when nothing is sellable. */
export function bestPriceCents(world: DemoWorld, sku: string): number | null {
  const sellable = entriesForSku(world, sku).filter((e) => sellableUnits(e) > 0);
  if (sellable.length === 0) return null;
  return Math.min(...sellable.map((e) => e.priceCents));
}

/** Total sellable units for a product across every store. */
export function totalSellable(world: DemoWorld, sku: string): number {
  return entriesForSku(world, sku).reduce((n, e) => n + sellableUnits(e), 0);
}
