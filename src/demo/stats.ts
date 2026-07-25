import type { Order } from '@/domain/types';
import { isTerminal } from '@/lib/orderState';
import {
  sellableUnits,
  stockStatus,
  type DemoWorld,
  type InventoryEntry,
} from './inventory';

/**
 * Pure widget selectors: everything the dashboard cards show is derived from
 * the demo world + the session's orders — no extra state to keep in sync.
 */

export interface StoreLevel {
  storeId: string;
  storeName: string;
  units: number;
  /** 0..1 relative to the fullest store (mini bar width). */
  ratio: number;
}

/** Total sellable units per store, plus a ratio for the mini bar viz. */
export function inventoryLevels(world: DemoWorld): StoreLevel[] {
  const perStore = world.stores.map((store) => {
    let units = 0;
    for (const product of world.products) {
      const entry = world.entries.get(`${store.id}:${product.sku}`);
      if (entry) units += sellableUnits(entry);
    }
    return { storeId: store.id, storeName: store.name, units };
  });
  const max = Math.max(1, ...perStore.map((s) => s.units));
  return perStore.map((s) => ({ ...s, ratio: s.units / max }));
}

export interface LowStockItem {
  sku: string;
  productName: string;
  storeName: string;
  sellable: number;
}

/** Store × product cells currently at `low` status, scarcest first. */
export function lowStockList(world: DemoWorld, limit = 6): LowStockItem[] {
  const out: LowStockItem[] = [];
  for (const entry of world.entries.values()) {
    if (stockStatus(entry) !== 'low') continue;
    const product = world.products.find((p) => p.sku === entry.sku);
    const store = world.stores.find((s) => s.id === entry.storeId);
    out.push({
      sku: entry.sku,
      productName: product?.name ?? entry.sku,
      storeName: store?.name ?? entry.storeId,
      sellable: sellableUnits(entry),
    });
  }
  return out.sort((a, b) => a.sellable - b.sellable).slice(0, limit);
}

export interface TopProduct {
  sku: string;
  name: string;
  units: number;
}

/** Most-ordered products across the session's orders. */
export function topProducts(orders: readonly Order[], limit = 5): TopProduct[] {
  const bySku = new Map<string, TopProduct>();
  for (const order of orders) {
    for (const item of order.items) {
      const existing = bySku.get(item.sku);
      if (existing) existing.units += item.qty;
      else bySku.set(item.sku, { sku: item.sku, name: item.name, units: item.qty });
    }
  }
  return [...bySku.values()].sort((a, b) => b.units - a.units).slice(0, limit);
}

/** Orders still moving through the pipeline. */
export function pendingCount(orders: readonly Order[]): number {
  return orders.filter((o) => !isTerminal(o.status)).length;
}

/** completed / (completed + failed), as a 0..100 percentage; null if none. */
export function fulfillmentRatePct(orders: readonly Order[]): number | null {
  const terminal = orders.filter((o) => isTerminal(o.status));
  if (terminal.length === 0) return null;
  const completed = terminal.filter((o) => o.status === 'completed').length;
  return Math.round((completed / terminal.length) * 100);
}

/** Orders created today (local time). */
export function todaysOrders(orders: readonly Order[], now = new Date()): number {
  return orders.filter((o) => {
    const d = new Date(o.createdAt);
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }).length;
}

/** Count of store × product cells per status — used by the badge legend. */
export function statusCounts(
  world: DemoWorld,
): Record<ReturnType<typeof stockStatus>, number> {
  const counts = { available: 0, low: 0, out: 0, reserved: 0 };
  for (const entry of world.entries.values()) {
    counts[stockStatus(entry)] += 1;
  }
  return counts;
}

/** Convenience: every entry of the world as an array (stable order). */
export function allEntries(world: DemoWorld): InventoryEntry[] {
  return [...world.entries.values()];
}
