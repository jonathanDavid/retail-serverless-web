import type { StockStatus } from '@/demo/inventory';

const STYLE: Record<StockStatus, { label: string; cls: string; dot: string }> = {
  available: {
    label: 'Disponible',
    cls: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30',
    dot: 'bg-emerald-400',
  },
  low: {
    label: 'Stock bajo',
    cls: 'bg-amber-500/15 text-amber-300 ring-amber-400/30',
    dot: 'bg-amber-400',
  },
  out: {
    label: 'Agotado',
    cls: 'bg-rose-500/15 text-rose-300 ring-rose-400/30',
    dot: 'bg-rose-400',
  },
  reserved: {
    label: 'Reservado',
    cls: 'bg-violet-500/15 text-violet-300 ring-violet-400/30',
    dot: 'bg-violet-400',
  },
};

/** Colored chip for an inventory status (Available/Low/Out/Reserved). */
export function StockBadge({ status }: { status: StockStatus }) {
  const s = STYLE[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${s.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
