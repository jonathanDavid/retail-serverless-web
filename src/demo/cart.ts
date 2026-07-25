import type { OrderItem } from '@/domain/types';
import type { ProductDef } from './catalog';
import {
  bestPriceCents,
  entriesForSku,
  sellableUnits,
  totalSellable,
  type DemoWorld,
} from './inventory';

/**
 * Pure cart logic. A cart line references a catalog product; its unit price is
 * the cheapest sellable per-store price at the time it was added (the
 * fulfillment plan may still source different lines from different stores).
 */

export interface CartLine {
  sku: string;
  name: string;
  qty: number;
  unitPriceCents: number;
}

export type CartAvailability = 'ok' | 'insufficient' | 'unavailable';

/** Add a product (or bump qty when the line exists). Returns a new array. */
export function addToCart(
  lines: readonly CartLine[],
  line: Omit<CartLine, 'qty'>,
  qty = 1,
): CartLine[] {
  const existing = lines.find((l) => l.sku === line.sku);
  if (existing) {
    return lines.map((l) =>
      l.sku === line.sku ? { ...l, qty: l.qty + qty } : l,
    );
  }
  return [...lines, { ...line, qty }];
}

/** Set a line's qty; qty <= 0 removes the line. Returns a new array. */
export function setCartQty(
  lines: readonly CartLine[],
  sku: string,
  qty: number,
): CartLine[] {
  if (qty <= 0) return lines.filter((l) => l.sku !== sku);
  return lines.map((l) =>
    l.sku === sku ? { ...l, qty: Math.trunc(qty) } : l,
  );
}

export function removeFromCart(
  lines: readonly CartLine[],
  sku: string,
): CartLine[] {
  return lines.filter((l) => l.sku !== sku);
}

export function lineTotalCents(line: CartLine): number {
  return line.qty * line.unitPriceCents;
}

export function cartTotalCents(lines: readonly CartLine[]): number {
  return lines.reduce((sum, l) => sum + lineTotalCents(l), 0);
}

export function cartItemCount(lines: readonly CartLine[]): number {
  return lines.reduce((n, l) => n + l.qty, 0);
}

/**
 * Availability of a line against the current world:
 *  - `unavailable`  no sellable units anywhere
 *  - `insufficient` some units, but fewer than requested
 *  - `ok`           the network can cover the quantity
 */
export function lineAvailability(
  world: DemoWorld,
  line: CartLine,
): CartAvailability {
  const sellable = totalSellable(world, line.sku);
  if (sellable <= 0) return 'unavailable';
  if (sellable < line.qty) return 'insufficient';
  return 'ok';
}

/** True when every line can be covered by the network. */
export function cartIsFulfillable(
  world: DemoWorld,
  lines: readonly CartLine[],
): boolean {
  return (
    lines.length > 0 &&
    lines.every((l) => lineAvailability(world, l) === 'ok')
  );
}

/** Translate cart lines into the contract's order items. */
export function cartToOrderItems(lines: readonly CartLine[]): OrderItem[] {
  return lines.map((l) => ({
    sku: l.sku,
    name: l.name,
    qty: l.qty,
    unitPriceCents: l.unitPriceCents,
  }));
}

/** Build a cart line for a product at its current best price. */
export function cartLineFromCatalog(
  world: DemoWorld,
  sku: string,
): Omit<CartLine, 'qty'> | null {
  const product = world.products.find((p) => p.sku === sku);
  if (!product) return null;
  const price = bestPriceCents(world, sku);
  if (price === null) return null;
  return { sku: product.sku, name: product.name, unitPriceCents: price };
}

/** Number of distinct stores that can actually sell a product right now. */
function sellableStoreCount(world: DemoWorld, sku: string): number {
  return entriesForSku(world, sku).filter((e) => sellableUnits(e) > 0).length;
}

/**
 * Build a RANDOMIZED sample cart for the "Pedido de ejemplo" button: a fresh
 * mix every click, biased so the order usually spans several stores (giving the
 * optimizer real headroom), with an occasional easy single-store order.
 *
 * Randomness is injected (`random`, default `Math.random`) so tests can drive it
 * deterministically; the button itself passes `Math.random` for genuine variety.
 * Always valid: only in-stock products, quantities capped at available stock.
 */
export function buildSampleCart(
  world: DemoWorld,
  random: () => number = Math.random,
): CartLine[] {
  const randInt = (min: number, max: number): number =>
    min + Math.floor(random() * (max - min + 1));

  const shuffle = <T>(arr: T[]): T[] => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const tmp = arr[i]!;
      arr[i] = arr[j]!;
      arr[j] = tmp;
    }
    return arr;
  };

  const inStock = world.products.filter((p) => totalSellable(world, p.sku) >= 1);
  if (inStock.length === 0) return [];

  const multiStore = inStock.filter((p) => sellableStoreCount(world, p.sku) >= 2);
  const singleStore = inStock.filter((p) => sellableStoreCount(world, p.sku) === 1);

  // ~20% of the time, build a genuinely easy single-store order (no headroom →
  // exercises the "Ya es óptimo" path) when there are enough single-store items.
  const wantEasy = random() < 0.2 && singleStore.length >= 3;

  let chosen: ProductDef[];
  if (wantEasy) {
    chosen = shuffle([...singleStore]).slice(0, randInt(3, Math.min(5, singleStore.length)));
  } else {
    const target = Math.min(randInt(3, 6), inStock.length);
    // Prefer multi-store items so the plan scatters and the GA can consolidate.
    chosen = shuffle([...multiStore]).slice(0, target);
    if (chosen.length < target) {
      const rest = shuffle(inStock.filter((p) => !chosen.includes(p)));
      chosen = [...chosen, ...rest.slice(0, target - chosen.length)];
    }
  }

  let cart: CartLine[] = [];
  for (const product of chosen) {
    const line = cartLineFromCatalog(world, product.sku);
    if (!line) continue;
    const available = totalSellable(world, product.sku);
    const qty = Math.max(1, Math.min(available, randInt(1, 4)));
    cart = addToCart(cart, line, qty);
  }
  return cart;
}
