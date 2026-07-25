import { useEffect } from 'react';
import { ordersApi } from '@/api/orders';
import { formatCentsCOP } from '@/lib/money';
import { useOrdersStore } from '@/store/ordersStore';
import { StatusBadge } from './StatusBadge';

/**
 * Recent orders from `GET /v1/orders` (newest first, server-capped). Refreshed
 * on mount and every 4s so newly completed orders from other sessions surface.
 */
export function RecentOrders() {
  const recent = useOrdersStore((s) => s.recent);
  const setRecent = useOrdersStore((s) => s.setRecent);
  const tracked = useOrdersStore((s) => s.tracked);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const orders = await ordersApi.listOrders(controller.signal);
        if (!cancelled) setRecent(orders);
      } catch {
        // Non-fatal: leave the last-known list in place.
      }
    }

    void load();
    const interval = setInterval(() => void load(), 4_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
      controller.abort();
    };
    // Re-run when a new order is tracked so the list reflects it promptly.
  }, [setRecent, tracked.length]);

  if (recent.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-xs text-slate-500">
        No orders recorded yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-surface-border/60">
      {recent.slice(0, 12).map((order) => (
        <li
          key={order.orderId}
          className="flex items-center justify-between gap-3 py-2.5"
        >
          <div className="min-w-0">
            <p className="truncate font-mono text-[11px] text-slate-400">
              {order.orderId.slice(0, 18)}
            </p>
            <p className="truncate text-xs text-slate-300">
              {order.customer.name} · {order.store}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-xs font-medium text-slate-200">
              {formatCentsCOP(order.totalCents)}
            </span>
            <StatusBadge status={order.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}
