import type { OrderItem, OrderStatus } from './types';

/** Blank manual-entry line item, priced in integer cents. */
export function emptyItem(): OrderItem {
  return { sku: '', name: '', qty: 1, unitPriceCents: 0 };
}

/** Demo store list. In production these come from the catalog service. */
export const STORES = [
  'Barranquilla-01',
  'Bogota-01',
  'Bogota-02',
  'Medellin-01',
  'Cali-01',
  'Cartagena-01',
] as const;

export type StoreId = (typeof STORES)[number];

/** Tailwind class fragments per status, used by badges and the stepper. */
export const STATUS_STYLE: Record<
  OrderStatus,
  { label: string; badge: string; dot: string }
> = {
  received: {
    label: 'Received',
    badge: 'bg-slate-500/15 text-slate-300 ring-slate-400/30',
    dot: 'bg-slate-400',
  },
  queued: {
    label: 'Queued',
    badge: 'bg-sky-500/15 text-sky-300 ring-sky-400/30',
    dot: 'bg-sky-400',
  },
  processing: {
    label: 'Processing',
    badge: 'bg-amber-500/15 text-amber-300 ring-amber-400/30',
    dot: 'bg-amber-400',
  },
  completed: {
    label: 'Completed',
    badge: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30',
    dot: 'bg-emerald-400',
  },
  failed: {
    label: 'Failed',
    badge: 'bg-rose-500/15 text-rose-300 ring-rose-400/30',
    dot: 'bg-rose-400',
  },
};
