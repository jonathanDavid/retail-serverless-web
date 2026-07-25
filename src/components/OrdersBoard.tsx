import { useOrdersStore } from '@/store/ordersStore';
import { Icon } from './ui/Icon';
import { OrderCard } from './OrderCard';

/**
 * The live board: one card per order submitted this session, newest first.
 * Each card independently polls its order to a terminal state.
 */
export function OrdersBoard() {
  const tracked = useOrdersStore((s) => s.tracked);

  if (tracked.length === 0) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-brand/30 bg-brand/[0.03] p-8 text-center">
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand/10 text-brand-soft ring-1 ring-inset ring-brand/20">
          <Icon name="bolt" className="h-5 w-5" />
        </span>
        <p className="text-sm font-semibold text-slate-200">
          Aún no hay pedidos en vivo
        </p>
        <p className="mt-1 max-w-xs text-xs text-slate-500">
          Pulsa{' '}
          <span className="font-semibold text-brand-soft">Realizar pedido</span>{' '}
          en el carrito y observa aquí cómo avanza en tiempo real:
          <span className="mt-2 block font-medium text-slate-400">
            recibido → en cola → procesando → completado
          </span>
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-1 2xl:grid-cols-2">
      {tracked.map((order) => (
        <OrderCard key={order.orderId} order={order} />
      ))}
    </div>
  );
}
