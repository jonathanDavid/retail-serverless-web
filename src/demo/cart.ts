import type { OrderItem } from '@/domain/types';
import { bestPriceCents, totalSellable, type DemoWorld } from './inventory';

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
