import { useState } from 'react';
import type { Order } from '@/domain/types';
import {
  OPTIMIZER_ENABLED,
  optimizePickupForOrder,
} from '@/api/optimizerClient';
import {
  buildComparison,
  type OptimizationComparison,
} from '@/lib/optimizerCompare';
import { formatCentsCOP } from '@/lib/money';
import { Icon } from '@/components/ui/Icon';

type Phase =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'done'; comparison: OptimizationComparison; generations: number }
  | { kind: 'error'; message: string };

/**
 * Optional "Optimizar recogida" action (hidden unless VITE_OPTIMIZER_URL is
 * set). Runs the genetic-visualizer pickup problem on a scenario seeded from
 * the orderId and shows un-optimized vs optimized metrics side by side.
 * Errors degrade to an inline message — the dashboard never depends on the
 * optimizer being up.
 */
export function OptimizePickup({ order }: { order: Order }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  if (!OPTIMIZER_ENABLED) return null;

  async function run(): Promise<void> {
    setPhase({ kind: 'running' });
    try {
      const result = await optimizePickupForOrder(order);
      setPhase({
        kind: 'done',
        comparison: buildComparison(result.before, result.after),
        generations: result.generations,
      });
    } catch (err) {
      setPhase({
        kind: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'El optimizador no está disponible.',
      });
    }
  }

  return (
    <div className="rounded-lg border border-brand/20 bg-brand/5 p-3">
      {phase.kind === 'idle' && (
        <button
          type="button"
          onClick={() => void run()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-brand/40 px-3 py-1.5 text-xs font-semibold text-brand-soft transition-all hover:bg-brand hover:text-white"
        >
          <Icon name="spark" className="h-3.5 w-3.5" />
          Optimizar recogida (algoritmo genético)
        </button>
      )}

      {phase.kind === 'running' && (
        <p className="flex items-center justify-center gap-2 py-1 text-xs text-brand-soft">
          <Icon name="refresh" className="h-3.5 w-3.5 animate-spin" />
          Evolucionando rutas de recogida…
        </p>
      )}

      {phase.kind === 'error' && (
        <div className="space-y-2">
          <p className="flex items-start gap-1.5 text-[11px] text-amber-300">
            <Icon name="alert" className="mt-0.5 h-3 w-3 shrink-0" />
            {phase.message}
          </p>
          <button
            type="button"
            onClick={() => void run()}
            className="text-[11px] font-medium text-brand-soft underline underline-offset-2 hover:text-white"
          >
            Reintentar
          </button>
        </div>
      )}

      {phase.kind === 'done' && (
        <ComparisonTable
          comparison={phase.comparison}
          generations={phase.generations}
        />
      )}
    </div>
  );
}

function ComparisonTable({
  comparison,
  generations,
}: {
  comparison: OptimizationComparison;
  generations: number;
}) {
  const rows: {
    label: string;
    before: string;
    after: string;
    better: boolean;
  }[] = [
    {
      label: 'Distancia',
      before: `${comparison.routeKm.before.toFixed(1)} km`,
      after: `${comparison.routeKm.after.toFixed(1)} km`,
      better: comparison.routeKm.delta < 0,
    },
    {
      label: 'Tiempo de viaje',
      before: `${comparison.travelMinutes.before} min`,
      after: `${comparison.travelMinutes.after} min`,
      better: comparison.travelMinutes.delta < 0,
    },
    {
      label: 'Tiendas visitadas',
      before: `${comparison.storesUsed.before}`,
      after: `${comparison.storesUsed.after}`,
      better: comparison.storesUsed.delta < 0,
    },
    {
      label: 'Costo de artículos',
      before: formatCentsCOP(comparison.itemCostCents.before),
      after: formatCentsCOP(comparison.itemCostCents.after),
      better: comparison.itemCostCents.delta < 0,
    },
  ];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-soft">
          <Icon name="spark" className="h-3.5 w-3.5" />
          Sin optimizar vs optimizado
        </p>
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-300 ring-1 ring-inset ring-emerald-400/30">
          −{Math.max(0, comparison.optimizationPct)}% costo total
        </span>
      </div>
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-left text-slate-500">
            <th className="py-1 font-medium">Métrica</th>
            <th className="py-1 text-right font-medium">Sin optimizar</th>
            <th className="py-1 text-right font-medium">Optimizado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-surface-border/40">
              <td className="py-1.5 text-slate-400">{row.label}</td>
              <td className="py-1.5 text-right text-slate-300">{row.before}</td>
              <td
                className={`py-1.5 text-right font-semibold ${
                  row.better ? 'text-emerald-300' : 'text-slate-200'
                }`}
              >
                {row.after}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-1.5 text-[10px] text-slate-600">
        {generations} generaciones · población inicial aleatoria como línea base
      </p>
    </div>
  );
}
