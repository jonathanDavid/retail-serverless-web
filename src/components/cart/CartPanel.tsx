import { useState } from 'react';
import { ordersApi } from '@/api/orders';
import { ApiError } from '@/api/client';
import {
  cartIsFulfillable,
  cartItemCount,
  cartToOrderItems,
  cartTotalCents,
  lineAvailability,
  lineTotalCents,
} from '@/demo/cart';
import { planFulfillment } from '@/demo/fulfillment';
import { formatCentsCOP } from '@/lib/money';
import { useDemoStore } from '@/store/demoStore';
import { useOrdersStore } from '@/store/ordersStore';
import { Icon } from '@/components/ui/Icon';
import { Term } from '@/components/ui/Tooltip';

const fieldClass =
  'w-full rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand';

/**
 * Shopping cart: quantity controls, line + running COP totals, availability
 * flags, and checkout. Checkout submits through the SAME demo pipeline as the
 * classic form (POST → 202 → polling → stepper → toasts) and registers the
 * fulfillment plan that will be shown — and committed against stock — when
 * the order completes.
 */
export function CartPanel() {
  const world = useDemoStore((s) => s.world);
  const cart = useDemoStore((s) => s.cart);
  const setQty = useDemoStore((s) => s.setQty);
  const removeSku = useDemoStore((s) => s.removeSku);
  const clearCart = useDemoStore((s) => s.clearCart);
  const registerPlan = useDemoStore((s) => s.registerPlan);
  const loadSampleCart = useDemoStore((s) => s.loadSampleCart);

  const addOptimisticOrder = useOrdersStore((s) => s.addOptimisticOrder);
  const pushToast = useOrdersStore((s) => s.pushToast);

  const [name, setName] = useState('Ana Gómez');
  const [email, setEmail] = useState('ana.gomez@example.co');
  const [submitting, setSubmitting] = useState(false);

  const total = cartTotalCents(cart);
  const count = cartItemCount(cart);
  const fulfillable = cartIsFulfillable(world, cart);

  async function checkout(): Promise<void> {
    if (!fulfillable || submitting) return;
    setSubmitting(true);
    try {
      const items = cartToOrderItems(cart);
      // Preview the plan so the order's `store` field carries the store that
      // anchors the pickup (planFulfillment is pure — no state touched yet).
      const preview = planFulfillment(world, items);
      const primaryStore =
        preview.storeSummary[0]?.storeName ?? 'Barranquilla-01';

      const req = {
        customer: { name: name.trim(), email: email.trim() },
        items,
        store: primaryStore,
      };
      const res = await ordersApi.createOrder(req);

      // Persist the plan under the real orderId; it is committed (stock
      // decremented) when the pipeline reports `completed`.
      registerPlan(res.orderId, items);

      addOptimisticOrder(res.orderId, req);
      pushToast({
        kind: 'info',
        title: 'Pedido aceptado (202)',
        message: `${res.orderId.slice(0, 8)} · encolado en la tubería`,
      });
      clearCart();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? `${err.code}: ${err.message}`
          : 'Error de red al enviar el pedido.';
      pushToast({ kind: 'error', title: 'No se pudo enviar', message });
    } finally {
      setSubmitting(false);
    }
  }

  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-brand/30 bg-brand/[0.04] px-4 py-8 text-center">
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand/10 text-brand-soft ring-1 ring-inset ring-brand/20">
          <Icon name="cart" className="h-5 w-5" />
        </span>
        <p className="text-sm font-semibold text-slate-200">
          Tu carrito está vacío
        </p>
        <p className="mt-1 max-w-xs text-xs text-slate-500">
          Agrega productos del inventario abajo — o prueba el demo al instante
          con un pedido de ejemplo.
        </p>
        <button
          type="button"
          onClick={loadSampleCart}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-brand/40 bg-brand/10 px-4 py-2 text-sm font-semibold text-brand-soft transition-all hover:-translate-y-px hover:bg-brand hover:text-white"
        >
          <Icon name="spark" className="h-4 w-4" />
          Cargar pedido de ejemplo
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {cart.map((line) => {
          const availability = lineAvailability(world, line);
          return (
            <li
              key={line.sku}
              className="rounded-lg border border-surface-border/50 bg-surface/60 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-200">
                    {line.name}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {formatCentsCOP(line.unitPriceCents)} c/u
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeSku(line.sku)}
                  aria-label={`Quitar ${line.name} del carrito`}
                  className="shrink-0 text-slate-600 transition-colors hover:text-rose-400"
                >
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="inline-flex items-center rounded-lg border border-surface-border">
                  <button
                    type="button"
                    onClick={() => setQty(line.sku, line.qty - 1)}
                    aria-label={`Reducir cantidad de ${line.name}`}
                    className="px-2 py-1 text-slate-400 transition-colors hover:text-white"
                  >
                    <Icon name="minus" className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-[2rem] text-center text-sm font-semibold text-slate-100">
                    {line.qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQty(line.sku, line.qty + 1)}
                    aria-label={`Aumentar cantidad de ${line.name}`}
                    className="px-2 py-1 text-slate-400 transition-colors hover:text-white"
                  >
                    <Icon name="plus" className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span className="text-sm font-semibold text-slate-100">
                  {formatCentsCOP(lineTotalCents(line))}
                </span>
              </div>
              {availability !== 'ok' && (
                <p className="mt-2 flex items-center gap-1.5 rounded-md bg-rose-500/10 px-2 py-1 text-[11px] text-rose-300 ring-1 ring-inset ring-rose-500/30">
                  <Icon name="alert" className="h-3 w-3 shrink-0" />
                  {availability === 'unavailable'
                    ? 'Sin existencias en ninguna tienda.'
                    : 'Stock insuficiente en la red — reduce la cantidad.'}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="grid grid-cols-1 gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-slate-500">
            Cliente
          </span>
          <input
            className={fieldClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-slate-500">
            Email
          </span>
          <input
            className={fieldClass}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
      </div>

      <div className="border-t border-surface-border pt-3">
        <div className="mb-3 flex items-end justify-between">
          <p className="text-xs text-slate-500">
            {count} {count === 1 ? 'artículo' : 'artículos'} en el carrito
          </p>
          <div className="text-right">
            <p className="text-[11px] text-slate-500">Total</p>
            <p className="text-2xl font-bold tracking-tight text-slate-100">
              {formatCentsCOP(total)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void checkout()}
          disabled={!fulfillable || submitting}
          className="group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-r from-indigo-500 via-brand to-sky-500 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-brand/30 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0 enabled:animate-pulse-glow"
        >
          <span
            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
            aria-hidden="true"
          />
          <Icon name="bolt" className="h-5 w-5" />
          {submitting ? 'Enviando pedido…' : 'Realizar pedido'}
          {!submitting && (
            <span className="transition-transform group-hover:translate-x-1">
              →
            </span>
          )}
        </button>
        <div className="mt-2.5 flex items-center justify-between">
          <button
            type="button"
            onClick={loadSampleCart}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 transition-colors hover:text-brand-soft"
          >
            <Icon name="spark" className="h-3 w-3" />
            Reemplazar con pedido de ejemplo
          </button>
          <button
            type="button"
            onClick={clearCart}
            className="text-[11px] font-medium text-slate-600 transition-colors hover:text-rose-400"
          >
            Vaciar carrito
          </button>
        </div>
      </div>
      <p className="text-[11px] leading-relaxed text-slate-600">
        El pedido entra por <Term term="202" label="202 Accepted" /> y avanza
        por la tubería (<Term term="SQS" />, <Term term="polling" label="sondeo" />
        ) hasta completarse.
      </p>
    </div>
  );
}
