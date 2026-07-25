import { useOrdersStore } from '@/store/ordersStore';
import { OrderCard } from './OrderCard';

/**
 * The live board: one card per order submitted this session, newest first.
 * Each card independently polls its order to a terminal state.
 */
export function OrdersBoard() {
  const tracked = useOrdersStore((s) => s.tracked);

  if (tracked.length === 0) {
    return (
      <div className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-surface-border bg-surface-raised/40 p-8 text-center">
        <p className="text-sm font-medium text-slate-300">No live orders yet</p>
        <p className="mt-1 max-w-xs text-xs text-slate-500">
          Submit the form to enqueue an order. It will appear here and advance
          through the pipeline in real time.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-1 xl:grid-cols-2">
      {tracked.map((order) => (
        <OrderCard key={order.orderId} order={order} />
      ))}
    </div>
  );
}
