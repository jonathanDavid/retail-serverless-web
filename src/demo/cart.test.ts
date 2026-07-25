import { describe, expect, it } from 'vitest';
import {
  addToCart,
  buildSampleCart,
  cartIsFulfillable,
  cartItemCount,
  cartToOrderItems,
  cartTotalCents,
  lineAvailability,
  lineTotalCents,
  removeFromCart,
  setCartQty,
  type CartLine,
} from './cart';
import { generateWorld, sellableUnits, entriesForSku, totalSellable } from './inventory';
import { mulberry32 } from '@/lib/rng';
import { buildScenario, hasOptimizationHeadroom } from './scenario';

const COFFEE: Omit<CartLine, 'qty'> = {
  sku: 'SKU-CAFE-250',
  name: 'Café tostado 250g',
  unitPriceCents: 1450000,
};
const RICE: Omit<CartLine, 'qty'> = {
  sku: 'SKU-ARROZ-500',
  name: 'Arroz blanco 500g',
  unitPriceCents: 380000,
};

describe('cart mutations', () => {
  it('adds a new line and bumps qty on repeat adds', () => {
    let cart = addToCart([], COFFEE);
    cart = addToCart(cart, COFFEE);
    cart = addToCart(cart, RICE, 3);
    expect(cart).toHaveLength(2);
    expect(cart.find((l) => l.sku === COFFEE.sku)?.qty).toBe(2);
    expect(cart.find((l) => l.sku === RICE.sku)?.qty).toBe(3);
  });

  it('setCartQty updates, truncates, and removes at zero', () => {
    let cart = addToCart([], COFFEE, 2);
    cart = setCartQty(cart, COFFEE.sku, 5.9);
    expect(cart[0]?.qty).toBe(5);
    cart = setCartQty(cart, COFFEE.sku, 0);
    expect(cart).toHaveLength(0);
  });

  it('removeFromCart drops only the targeted line', () => {
    let cart = addToCart(addToCart([], COFFEE), RICE);
    cart = removeFromCart(cart, COFFEE.sku);
    expect(cart.map((l) => l.sku)).toEqual([RICE.sku]);
  });

  it('never mutates the input array', () => {
    const original = addToCart([], COFFEE);
    const snapshot = JSON.stringify(original);
    addToCart(original, COFFEE);
    setCartQty(original, COFFEE.sku, 9);
    removeFromCart(original, COFFEE.sku);
    expect(JSON.stringify(original)).toBe(snapshot);
  });
});

describe('cart totals', () => {
  it('computes line totals and the running COP total in integer cents', () => {
    const cart = addToCart(addToCart([], COFFEE, 2), RICE, 3);
    const coffee = cart.find((l) => l.sku === COFFEE.sku);
    expect(coffee && lineTotalCents(coffee)).toBe(2900000);
    expect(cartTotalCents(cart)).toBe(2 * 1450000 + 3 * 380000);
    expect(Number.isInteger(cartTotalCents(cart))).toBe(true);
    expect(cartItemCount(cart)).toBe(5);
  });

  it('an empty cart totals zero and is not fulfillable', () => {
    expect(cartTotalCents([])).toBe(0);
    expect(cartIsFulfillable(generateWorld(1), [])).toBe(false);
  });
});

describe('availability against the world', () => {
  const world = generateWorld(42);

  it('reports ok when the network can cover the quantity', () => {
    // Find a product with healthy network stock.
    const product = world.products.find(
      (p) =>
        entriesForSku(world, p.sku).reduce((n, e) => n + sellableUnits(e), 0) >
        5,
    );
    expect(product).toBeDefined();
    if (!product) return;
    const line: CartLine = {
      sku: product.sku,
      name: product.name,
      qty: 1,
      unitPriceCents: 100000,
    };
    expect(lineAvailability(world, line)).toBe('ok');
  });

  it('reports insufficient when qty exceeds network stock', () => {
    const product = world.products[0]!;
    const line: CartLine = {
      sku: product.sku,
      name: product.name,
      qty: 1_000_000,
      unitPriceCents: 100000,
    };
    expect(['insufficient', 'unavailable']).toContain(
      lineAvailability(world, line),
    );
  });

  it('reports unavailable for a sku no store carries', () => {
    const line: CartLine = {
      sku: 'SKU-NO-EXISTE',
      name: 'Fantasma',
      qty: 1,
      unitPriceCents: 100,
    };
    expect(lineAvailability(world, line)).toBe('unavailable');
  });
});

describe('cartToOrderItems', () => {
  it('maps 1:1 onto the contract order-item shape', () => {
    const cart = addToCart([], COFFEE, 2);
    expect(cartToOrderItems(cart)).toEqual([
      { sku: COFFEE.sku, name: COFFEE.name, qty: 2, unitPriceCents: 1450000 },
    ]);
  });
});

describe('buildSampleCart (randomized sample order)', () => {
  const world = generateWorld(2026);

  it('always yields a valid, in-stock, fulfillable cart', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const cart = buildSampleCart(world, mulberry32(seed));
      expect(cart.length).toBeGreaterThanOrEqual(3);
      expect(cart.length).toBeLessThanOrEqual(6);
      for (const line of cart) {
        expect(line.qty).toBeGreaterThanOrEqual(1);
        expect(line.qty).toBeLessThanOrEqual(4);
        // Only in-stock products, and never more than the network can supply.
        expect(totalSellable(world, line.sku)).toBeGreaterThanOrEqual(line.qty);
      }
      // No duplicate skus (each product is a single line).
      expect(new Set(cart.map((l) => l.sku)).size).toBe(cart.length);
      expect(cartIsFulfillable(world, cart)).toBe(true);
    }
  });

  it('produces a fresh mix across clicks (variety)', () => {
    const signatures = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const cart = buildSampleCart(world, mulberry32(seed));
      signatures.add(
        cart
          .map((l) => `${l.sku}x${l.qty}`)
          .sort()
          .join('|'),
      );
    }
    // Many distinct orders, not the same three products every time.
    expect(signatures.size).toBeGreaterThanOrEqual(8);
  });

  it('usually spans multiple stores → real optimization headroom', () => {
    let withHeadroom = 0;
    const runs = 16;
    for (let seed = 1; seed <= runs; seed++) {
      const cart = buildSampleCart(world, mulberry32(seed));
      const scenario = buildScenario(world, cartToOrderItems(cart));
      if (hasOptimizationHeadroom(scenario)) withHeadroom += 1;
    }
    // The multi-store bias means the strong majority of samples have headroom.
    expect(withHeadroom).toBeGreaterThanOrEqual(Math.ceil(runs * 0.7));
  });

  it('returns an empty cart when nothing is in stock', () => {
    const empty = { ...world, entries: new Map() };
    expect(buildSampleCart(empty, mulberry32(1))).toEqual([]);
  });
});
