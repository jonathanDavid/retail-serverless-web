import { useState } from 'react';
import type { Order } from '@/domain/types';
import {
  OPTIMIZER_ENABLED,
  optimizePickupForOrder,
  type OptimizerOutcome,
} from '@/api/optimizerClient';
import {
  buildComparison,
  totalCostCents,
  type OptimizationComparison,
  type PickupMetrics,
} from '@/lib/optimizerCompare';
import { formatCentsCOP } from '@/lib/money';
import { useDemoStore } from '@/store/demoStore';
import { Icon } from '@/components/ui/Icon';

type Phase =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'compared'; comparison: OptimizationComparison; generations: number }
  | { kind: 'optimal'; plan: PickupMetrics; reason: 'single-store' | 'no-gain' }
  | { kind: 'error'; message: string };

/**
 * Optional "Optimizar recogida" action (hidden unless VITE_OPTIMIZER_URL is
 * set). It optimizes the REAL order against the REAL store inventory via the
 * genetic-visualizer pickup problem, shows the naive plan vs the GA plan, and —
 * when a single store already covers the order — an honest "already optimal"
 * state instead of a fake −0%.
 */
export function OptimizePickup({ order }: { order: Order }) {
  const world = useDemoStore((s) => s.world);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  if (!OPTIMIZER_ENABLED) return null;

  async function run(): Promise<void> {
    setPhase({ kind: 'running' });
    try {
      const outcome: OptimizerOutcome = await optimizePickupForOrder(order, world);
      if (outcome.kind === 'already-optimal') {
        setPhase({ kind: 'optimal', plan: outcome.plan, reason: outcome.reason });
      } else {
        setPhase({
          kind: 'compared',
          comparison: buildComparison(outcome.before, outcome.after),
          generations: outcome.generations,
        });
      }
    } catch (err) {
      setPhase({
        kind: 'error',
        message:
          err instanceof Error ? err.message : 'El optimizador no está disponible.',
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

      {phase.kind === 'optimal' && (
        <AlreadyOptimal plan={phase.plan} reason={phase.reason} />
      )}

      {phase.kind === 'compared' && (
        <ComparisonTable
          comparison={phase.comparison}
          generations={phase.generations}
        />
      )}
    </div>
  );
}

function AlreadyOptimal({
  plan,
  reason,
}: {
  plan: PickupMetrics;
  reason: 'single-store' | 'no-gain';
}) {
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
        <Icon name="check" className="h-3.5 w-3.5" />
        Ya es óptimo
      </p>
      <p className="text-[11px] leading-relaxed text-slate-400">
        {reason === 'single-store'
          ? 'Un solo local cubre todo el pedido — no hay rutas alternativas que consolidar.'
          : 'El plan actual ya no se puede mejorar: el algoritmo no encontró una recogida más barata.'}
      </p>
      <p className="text-[11px] text-slate-500">
        {plan.storesUsed} {plan.storesUsed === 1 ? 'tienda' : 'tiendas'} ·{' '}
        {plan.routeKm.toFixed(1)} km · ~{plan.travelMinutes} min ·{' '}
        {formatCentsCOP(totalCostCents(plan))} costo total
      </p>
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
    {
      label: 'Costo total',
      before: formatCentsCOP(comparison.totalCostCents.before),
      after: formatCentsCOP(comparison.totalCostCents.after),
      better: comparison.totalCostCents.delta < 0,
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
          −{comparison.optimizationPct}% costo total
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
        {generations} generaciones · línea base: tienda más cercana por artículo
        (sin consolidar)
      </p>
    </div>
  );
}
