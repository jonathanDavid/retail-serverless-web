import type { Order } from '@/domain/types';
import { formatCentsCOP } from '@/lib/money';
import { useOrderPolling } from '@/hooks/useOrderPolling';
import { StateStepper } from './StateStepper';
import { StatusBadge } from './StatusBadge';

interface Props {
  order: Order;
}

/**
 * A live order card. Mounts the polling hook for its order (which stops on a
 * terminal state) and renders the stepper, totals, and — on failure — the
 * server's failure reason.
 */
export function OrderCard({ order }: Props) {
  useOrderPolling(order.orderId, order.status, order.createdAt);

  const itemCount = order.items.reduce((n, i) => n + i.qty, 0);

  return (
    <article className="animate-fade-in-up rounded-xl border border-surface-border bg-surface-raised p-4 shadow-sm">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-xs text-slate-400">
            {order.orderId}
          </p>
          <p className="mt-0.5 truncate text-sm font-medium text-slate-200">
            {order.customer.name}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </header>

      <div className="mb-4">
        <StateStepper status={order.status} />
      </div>

      {order.status === 'failed' && order.failureReason && (
        <p className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {order.failureReason}
        </p>
      )}

      <dl className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-slate-500">Store</dt>
          <dd className="mt-0.5 font-medium text-slate-300">{order.store}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Items</dt>
          <dd className="mt-0.5 font-medium text-slate-300">
            {itemCount} · {order.items.length} SKU
            {order.items.length === 1 ? '' : 's'}
          </dd>
        </div>
        <div className="text-right">
          <dt className="text-slate-500">Total</dt>
          <dd className="mt-0.5 font-semibold text-slate-100">
            {formatCentsCOP(order.totalCents)}
          </dd>
        </div>
      </dl>
    </article>
  );
}
