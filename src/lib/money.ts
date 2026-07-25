/**
 * Money helpers. The backend stores every amount as an integer number of COP
 * cents (never a float) to avoid rounding drift. COP has no minor unit in
 * practice, but the contract standardises on cents across all three repos, so
 * $1.500 COP is stored as `150000` cents.
 *
 * All formatting is `es-CO` locale, `COP` currency.
 */

const COP_FORMATTER = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Convert an integer cent amount to whole COP pesos (rounded to nearest peso). */
export function centsToPesos(cents: number): number {
  return Math.round(cents) / 100;
}

/**
 * Format an integer cent amount as an es-CO COP currency string,
 * e.g. `150000` → `"$ 1.500"`.
 */
export function formatCentsCOP(cents: number): string {
  if (!Number.isFinite(cents)) {
    return COP_FORMATTER.format(0);
  }
  return COP_FORMATTER.format(centsToPesos(cents));
}

/**
 * Parse a user-typed peso string (es-CO grouping, e.g. "1.500" or "$ 1.500")
 * back into integer cents. Returns `0` for empty/unparseable input.
 */
export function parsePesosToCents(input: string): number {
  const digits = input.replace(/[^\d]/g, '');
  if (digits === '') return 0;
  const pesos = Number.parseInt(digits, 10);
  return Number.isFinite(pesos) ? pesos * 100 : 0;
}
