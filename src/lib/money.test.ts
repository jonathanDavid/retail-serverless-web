import { describe, expect, it } from 'vitest';
import { centsToPesos, formatCentsCOP, parsePesosToCents } from './money';

describe('centsToPesos', () => {
  it('divides integer cents into pesos', () => {
    expect(centsToPesos(150000)).toBe(1500);
    expect(centsToPesos(4500000)).toBe(45000);
    expect(centsToPesos(0)).toBe(0);
  });

  it('rounds fractional cents to the nearest peso value', () => {
    expect(centsToPesos(149)).toBeCloseTo(1.49, 5);
  });
});

describe('formatCentsCOP', () => {
  it('formats cents as an es-CO grouped currency string', () => {
    // 150000 cents = 1.500 pesos. es-CO groups thousands with a period.
    const out = formatCentsCOP(150000);
    expect(out.replace(/[^\d]/g, '')).toBe('1500');
    expect(out).toContain('1.500');
  });

  it('formats a larger amount with multiple grouping separators', () => {
    const out = formatCentsCOP(1234567800); // 12.345.678 pesos
    expect(out.replace(/[^\d]/g, '')).toBe('12345678');
    expect(out).toContain('12.345.678');
  });

  it('renders no fractional part (COP minor unit is suppressed)', () => {
    const out = formatCentsCOP(450000); // 4.500 pesos
    expect(out).not.toMatch(/,\d/);
  });

  it('is resilient to non-finite input', () => {
    expect(formatCentsCOP(Number.NaN).replace(/[^\d]/g, '')).toBe('0');
    expect(formatCentsCOP(Number.POSITIVE_INFINITY).replace(/[^\d]/g, '')).toBe(
      '0',
    );
  });
});

describe('parsePesosToCents', () => {
  it('parses grouped peso strings into integer cents', () => {
    expect(parsePesosToCents('1.500')).toBe(150000);
    expect(parsePesosToCents('$ 1.500')).toBe(150000);
    expect(parsePesosToCents('45000')).toBe(4500000);
  });

  it('returns 0 for empty or non-numeric input', () => {
    expect(parsePesosToCents('')).toBe(0);
    expect(parsePesosToCents('abc')).toBe(0);
  });

  it('round-trips with formatCentsCOP', () => {
    const cents = 4500000;
    expect(parsePesosToCents(formatCentsCOP(cents))).toBe(cents);
  });
});
