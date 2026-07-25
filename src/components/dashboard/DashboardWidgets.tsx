import { useMemo, type ReactNode } from 'react';
import {
  fulfillmentRatePct,
  inventoryLevels,
  lowStockList,
  pendingCount,
  todaysOrders,
  topProducts,
} from '@/demo/stats';
import { useCountUp } from '@/hooks/useCountUp';
import { useDemoStore } from '@/store/demoStore';
import { useOrdersStore } from '@/store/ordersStore';
import { Icon, type IconName } from '@/components/ui/Icon';

/**
 * The at-a-glance widget row: inventory levels (mini bars), pending orders,
 * fulfillment rate, today's orders, low-stock list, and top products — all
 * derived live from demo state, with count-up transitions.
 */
export function DashboardWidgets() {
  const world = useDemoStore((s) => s.world);
  const tracked = useOrdersStore((s) => s.tracked);

  const levels = useMemo(() => inventoryLevels(world), [world]);
  const low = useMemo(() => lowStockList(world), [world]);
  const top = useMemo(() => topProducts(tracked), [tracked]);

  const pending = pendingCount(tracked);
  const rate = fulfillmentRatePct(tracked);
  const today = todaysOrders(tracked);
  const totalUnits = levels.reduce((n, l) => n + l.units, 0);

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatCard
        icon="clock"
        label="Pedidos pendientes"
        value={pending}
        hint="en la tubería"
        accent="text-amber-300"
      />
      <StatCard
        icon="check"
        label="Tasa de cumplimiento"
        value={rate ?? 0}
        suffix={rate === null ? '' : '%'}
        hint={rate === null ? 'sin pedidos aún' : 'completados vs fallidos'}
        accent="text-emerald-300"
      />
      <StatCard
        icon="cart"
        label="Pedidos de hoy"
        value={today}
        hint="esta sesión"
        accent="text-sky-300"
      />
      <StatCard
        icon="box"
        label="Unidades en red"
        value={totalUnits}
        hint={`${world.stores.length} tiendas`}
        accent="text-brand-soft"
      />

      {/* Inventory levels mini bars */}
      <WidgetCard
        icon="chart"
        title="Inventario por tienda"
        className="col-span-2"
      >
        <ul className="space-y-2">
          {levels.map((level) => (
            <li key={level.storeId}>
              <div className="mb-0.5 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">{level.storeName}</span>
                <span className="font-medium text-slate-300">
                  {level.units} uds
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-border/60">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand to-sky-400 transition-all duration-700"
                  style={{ width: `${Math.round(level.ratio * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </WidgetCard>

      {/* Low stock */}
      <WidgetCard icon="alert" title="Stock bajo">
        {low.length === 0 ? (
          <p className="py-2 text-[11px] text-slate-600">
            Nada por debajo del umbral.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {low.map((item) => (
              <li
                key={`${item.storeName}:${item.sku}`}
                className="flex items-center justify-between gap-2 text-[11px]"
              >
                <span className="min-w-0 truncate text-slate-400">
                  {item.productName}
                  <span className="text-slate-600"> · {item.storeName}</span>
                </span>
                <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 font-semibold text-amber-300">
                  {item.sellable}
                </span>
              </li>
            ))}
          </ul>
        )}
      </WidgetCard>

      {/* Top products */}
      <WidgetCard icon="spark" title="Más pedidos">
        {top.length === 0 ? (
          <p className="py-2 text-[11px] text-slate-600">
            Aún no hay pedidos en la sesión.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {top.map((product, i) => (
              <li
                key={product.sku}
                className="flex items-center justify-between gap-2 text-[11px]"
              >
                <span className="min-w-0 truncate text-slate-400">
                  <span className="mr-1 font-mono text-slate-600">{i + 1}.</span>
                  {product.name}
                </span>
                <span className="shrink-0 font-semibold text-slate-200">
                  {product.units} uds
                </span>
              </li>
            ))}
          </ul>
        )}
      </WidgetCard>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  suffix = '',
  hint,
  accent,
}: {
  icon: IconName;
  label: string;
  value: number;
  suffix?: string;
  hint: string;
  accent: string;
}) {
  const display = useCountUp(value);
  return (
    <div className="glass group rounded-xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand/10">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          {label}
        </span>
        <Icon name={icon} className={`h-4 w-4 ${accent}`} />
      </div>
      <p className={`text-2xl font-bold tabular-nums tracking-tight ${accent}`}>
        {Math.round(display)}
        {suffix}
      </p>
      <p className="mt-0.5 text-[11px] text-slate-600">{hint}</p>
    </div>
  );
}

function WidgetCard({
  icon,
  title,
  children,
  className = '',
}: {
  icon: IconName;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`glass rounded-xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand/10 ${className}`}
    >
      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-slate-300">
        <Icon name={icon} className="h-3.5 w-3.5 text-brand-soft" />
        {title}
      </p>
      {children}
    </div>
  );
}
