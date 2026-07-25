import { splitExplanation, type FulfillmentPlan } from '@/demo/fulfillment';
import { Icon } from '@/components/ui/Icon';

/**
 * Post-completion fulfillment story: which store covers each line, how the
 * order splits, and the estimated pickup route with total travel time.
 */
export function FulfillmentPlanView({ plan }: { plan: FulfillmentPlan }) {
  return (
    <div className="space-y-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
        <Icon name="store" className="h-3.5 w-3.5" />
        Plan de recogida
      </p>

      <p className="text-[11px] leading-relaxed text-slate-300">
        {splitExplanation(plan)}
      </p>

      <ul className="space-y-1">
        {plan.lines.map((line) => (
          <li
            key={line.sku}
            className="flex items-start justify-between gap-2 text-[11px]"
          >
            <span className="min-w-0 truncate text-slate-400">
              {line.qty}× {line.name}
            </span>
            <span className="shrink-0 text-right text-slate-300">
              {line.pieces.map((p) => `${p.storeName} (${p.qty})`).join(' + ')}
              {line.shortfall > 0 && (
                <span className="text-rose-300"> · faltan {line.shortfall}</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {plan.route.length > 0 && (
        <div className="border-t border-emerald-500/10 pt-2">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
            <Icon name="route" className="h-3.5 w-3.5" />
            Ruta estimada
          </p>
          <p className="text-[11px] leading-relaxed text-slate-300">
            Casa{' '}
            {plan.route.map((stop) => (
              <span key={stop.storeId}>
                → <span className="text-slate-100">{stop.storeName}</span>{' '}
                <span className="text-slate-500">
                  ({stop.legKm.toFixed(1)} km)
                </span>{' '}
              </span>
            ))}
            → Casa
          </p>
          <p className="mt-1.5 flex items-center gap-3 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Icon name="pin" className="h-3 w-3" />
              {plan.totalKm.toFixed(1)} km en total
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon name="clock" className="h-3 w-3" />~{plan.travelMinutes} min
              a 30 km/h
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
