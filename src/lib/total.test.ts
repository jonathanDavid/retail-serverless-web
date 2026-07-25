import { describe, expect, it } from 'vitest';
import type { OrderItem } from '@/domain/types';
import { computeTotalCents } from './orderState';
import { formatCentsCOP } from './money';

describe('computeTotalCents', () => {
  it('sums qty * unitPriceCents across items (server-authoritative total)', () => {
    const items: OrderItem[] = [
      { sku: 'A', name: 'Coffee', qty: 2, unitPriceCents: 4500000 },
      { sku: 'B', name: 'Mug', qty: 1, unitPriceCents: 100000 },
    ];
    // 2 * 45.000 + 1 * 1.000 = 91.000 pesos = 9_100_000 cents
    expect(computeTotalCents(items)).toBe(9_100_000);
    expect(formatCentsCOP(computeTotalCents(items)).replace(/[^\d]/g, '')).toBe(
      '91000',
    );
  });

  it('returns 0 for an empty basket', () => {
    expect(computeTotalCents([])).toBe(0);
  });

  it('stays an integer number of cents (no float drift)', () => {
    const items: OrderItem[] = [
      { sku: 'C', name: 'Item', qty: 3, unitPriceCents: 333300 },
    ];
    const total = computeTotalCents(items);
    expect(Number.isInteger(total)).toBe(true);
    expect(total).toBe(999900);
  });

  it('treats non-finite qty/price as 0 rather than propagating NaN', () => {
    const items = [
      { sku: 'D', name: 'Bad', qty: Number.NaN, unitPriceCents: 1000 },
      { sku: 'E', name: 'Good', qty: 2, unitPriceCents: 1000 },
    ] as OrderItem[];
    expect(computeTotalCents(items)).toBe(2000);
  });
});
