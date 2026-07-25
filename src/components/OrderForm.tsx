import { type FormEvent, useMemo, useState } from 'react';
import type { CreateOrderRequest, OrderItem } from '@/domain/types';
import { STORES } from '@/domain/constants';
import { ordersApi } from '@/api/orders';
import { ApiError } from '@/api/client';
import { computeTotalCents, validateCreateOrder } from '@/lib/orderState';
import { formatCentsCOP } from '@/lib/money';
import { useOrdersStore } from '@/store/ordersStore';
import { LineItemsEditor, emptyItem } from './LineItemsEditor';
import { StoreSelector } from './StoreSelector';

const fieldClass =
  'w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand';

/** A sensible starter basket so the demo is one click from a live order. */
function seedItems(): OrderItem[] {
  return [
    {
      sku: 'SKU-COFFEE-500',
      name: 'Specialty Coffee 500g',
      qty: 2,
      unitPriceCents: 4500000,
    },
  ];
}

/**
 * Order intake form. On submit it POSTs to `/v1/orders`, expects `202
 * { orderId }`, then optimistically drops a card onto the live board (which
 * starts polling immediately). Validation mirrors the API's zod schema so bad
 * input is caught before the round-trip.
 */
export function OrderForm() {
  const addOptimisticOrder = useOrdersStore((s) => s.addOptimisticOrder);
  const pushToast = useOrdersStore((s) => s.pushToast);

  const [name, setName] = useState('Ana Gómez');
  const [email, setEmail] = useState('ana.gomez@example.co');
  const [store, setStore] = useState<string>(STORES[0]);
  const [items, setItems] = useState(seedItems);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const totalCents = useMemo(() => computeTotalCents(items), [items]);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    const req: CreateOrderRequest = {
      customer: { name: name.trim(), email: email.trim() },
      items,
      store,
    };

    const validationErrors = validateCreateOrder(req);
    setErrors(validationErrors);
    if (validationErrors.length > 0) return;

    setSubmitting(true);
    try {
      const res = await ordersApi.createOrder(req);
      addOptimisticOrder(res.orderId, req);
      pushToast({
        kind: 'info',
        title: 'Order accepted (202)',
        message: `${res.orderId.slice(0, 8)} · enqueued`,
      });
      // Reset items to a fresh single row; keep customer/store for fast re-entry.
      setItems([emptyItem()]);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? `${err.code}: ${err.message}`
          : 'Network error — is the API reachable?';
      pushToast({ kind: 'error', title: 'Submission failed', message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">
            Customer name
          </span>
          <input
            className={fieldClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ana Gómez"
            autoComplete="name"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">
            Customer email
          </span>
          <input
            className={fieldClass}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ana@example.co"
            autoComplete="email"
          />
        </label>
      </div>

      <label className="block sm:max-w-xs">
        <span className="mb-1 block text-xs font-medium text-slate-400">Store</span>
        <StoreSelector value={store} onChange={setStore} />
      </label>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Line items</span>
          <button
            type="button"
            onClick={() => setItems([...items, emptyItem()])}
            className="rounded-md px-2 py-1 text-xs font-medium text-brand-soft transition-colors hover:bg-brand/10"
          >
            + Add item
          </button>
        </div>
        <LineItemsEditor items={items} onChange={setItems} />
      </div>

      {errors.length > 0 && (
        <ul className="space-y-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {errors.map((err) => (
            <li key={err}>• {err}</li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between border-t border-surface-border pt-4">
        <div>
          <p className="text-xs text-slate-500">Order total</p>
          <p className="text-lg font-semibold text-slate-100">
            {formatCentsCOP(totalCents)}
          </p>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Submitting…' : 'Submit order'}
        </button>
      </div>
    </form>
  );
}
