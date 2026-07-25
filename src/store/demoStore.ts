import { create } from 'zustand';
import type { OrderItem } from '@/domain/types';
import {
  addToCart,
  buildSampleCart,
  cartLineFromCatalog,
  removeFromCart,
  setCartQty,
  type CartLine,
} from '@/demo/cart';
import { planFulfillment, type FulfillmentPlan } from '@/demo/fulfillment';
import {
  entryKey,
  generateWorld,
  type DemoWorld,
} from '@/demo/inventory';

/**
 * Demo-world state: the seeded inventory, the shopping cart, and fulfillment
 * plans keyed by orderId. Only mounted-in-demo-mode components read this;
 * connected (live API) mode never touches it.
 *
 * Stock mutation happens in exactly one place — `commitFulfillment` — which
 * runs once per order when its pipeline completes, decrementing the sold
 * units so Low/Out badges and the dashboard widgets react.
 */

interface DemoState {
  world: DemoWorld;
  /** True while a reseed is "loading" (drives the skeleton). */
  reseeding: boolean;
  cart: CartLine[];
  /** Plans created at checkout, committed (stock decremented) on completion. */
  plans: Record<string, FulfillmentPlan & { committed: boolean }>;

  reseed(): void;
  finishReseed(seed: number): void;

  addSkuToCart(sku: string): void;
  /** One-click sample: fill the cart with a few in-stock products to test fast. */
  loadSampleCart(): void;
  setQty(sku: string, qty: number): void;
  removeSku(sku: string): void;
  clearCart(): void;

  /** Plan fulfillment for the given items and remember it under orderId. */
  registerPlan(orderId: string, items: readonly OrderItem[]): FulfillmentPlan;
  /** Decrement demo stock for a completed order (idempotent). */
  commitFulfillment(orderId: string): void;
  /** Drop the plan of a failed order without touching stock. */
  releasePlan(orderId: string): void;
}

const INITIAL_SEED = 4207;
/** Simulated latency for "actualizar inventario" so the skeleton is visible. */
const RESEED_LATENCY_MS = 650;

export const useDemoStore = create<DemoState>((set, get) => ({
  world: generateWorld(INITIAL_SEED),
  reseeding: false,
  cart: [],
  plans: {},

  reseed() {
    if (get().reseeding) return;
    set({ reseeding: true });
    const nextSeed = Math.floor(Math.random() * 1_000_000);
    setTimeout(() => get().finishReseed(nextSeed), RESEED_LATENCY_MS);
  },

  finishReseed(seed) {
    set({ world: generateWorld(seed), reseeding: false, cart: [] });
  },

  addSkuToCart(sku) {
    const { world, cart } = get();
    const line = cartLineFromCatalog(world, sku);
    if (!line) return;
    set({ cart: addToCart(cart, line) });
  },

  loadSampleCart() {
    // Randomized every click (Math.random) so the product mix — and therefore
    // the fulfilling stores and optimization outcome — visibly varies run to run.
    set({ cart: buildSampleCart(get().world) });
  },

  setQty(sku, qty) {
    set({ cart: setCartQty(get().cart, sku, qty) });
  },

  removeSku(sku) {
    set({ cart: removeFromCart(get().cart, sku) });
  },

  clearCart() {
    set({ cart: [] });
  },

  registerPlan(orderId, items) {
    const plan = planFulfillment(get().world, items);
    set((state) => ({
      plans: { ...state.plans, [orderId]: { ...plan, committed: false } },
    }));
    return plan;
  },

  commitFulfillment(orderId) {
    const { plans, world } = get();
    const plan = plans[orderId];
    if (!plan || plan.committed) return;

    // Decrement sellable stock for every fulfilled piece.
    const entries = new Map(world.entries);
    for (const line of plan.lines) {
      for (const piece of line.pieces) {
        const key = entryKey(piece.storeId, line.sku);
        const entry = entries.get(key);
        if (!entry) continue;
        entries.set(key, {
          ...entry,
          stock: Math.max(0, entry.stock - piece.qty),
        });
      }
    }

    set((state) => ({
      world: { ...world, entries },
      plans: {
        ...state.plans,
        [orderId]: { ...plan, committed: true },
      },
    }));
  },

  releasePlan(orderId) {
    set((state) => {
      const next = { ...state.plans };
      delete next[orderId];
      return { plans: next };
    });
  },
}));
