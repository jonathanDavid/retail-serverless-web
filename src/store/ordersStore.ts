import { create } from 'zustand';
import type { CreateOrderRequest, Order, OrderStatus } from '@/domain/types';
import { computeTotalCents, isTerminal } from '@/lib/orderState';

/**
 * Central client state. Deliberately small: two collections plus toasts.
 *
 *  - `tracked`   orders submitted in THIS session, in submission order. Each is
 *                created optimistically on POST (status `received`) and then
 *                reconciled by the polling hook as the server advances it.
 *  - `recent`    the last-known result of `GET /v1/orders`, newest first.
 *  - `toasts`    transient notifications (terminal-state feedback, errors).
 */

export interface Toast {
  id: string;
  kind: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}

interface OrdersState {
  tracked: Order[];
  recent: Order[];
  toasts: Toast[];

  /** Optimistically add a just-submitted order (status `received`). */
  addOptimisticOrder(orderId: string, req: CreateOrderRequest): Order;
  /** Reconcile a tracked order with a fresh server snapshot. */
  reconcileOrder(order: Order): void;
  /** Replace the recent-orders list. */
  setRecent(orders: Order[]): void;

  pushToast(toast: Omit<Toast, 'id'>): void;
  dismissToast(id: string): void;
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

export const useOrdersStore = create<OrdersState>((set, get) => ({
  tracked: [],
  recent: [],
  toasts: [],

  addOptimisticOrder(orderId, req) {
    const now = new Date().toISOString();
    const optimistic: Order = {
      orderId,
      status: 'received',
      customer: req.customer,
      items: req.items,
      currency: 'COP',
      totalCents: computeTotalCents(req.items),
      store: req.store,
      createdAt: now,
      updatedAt: now,
      failureReason: null,
    };
    set((state) => ({ tracked: [optimistic, ...state.tracked] }));
    return optimistic;
  },

  reconcileOrder(order) {
    const prev = get().tracked.find((o) => o.orderId === order.orderId);
    const prevStatus: OrderStatus | undefined = prev?.status;

    set((state) => ({
      tracked: state.tracked.map((o) =>
        o.orderId === order.orderId ? order : o,
      ),
    }));

    // Fire a toast exactly once, on the transition INTO a terminal state.
    if (
      isTerminal(order.status) &&
      prevStatus !== undefined &&
      !isTerminal(prevStatus)
    ) {
      if (order.status === 'completed') {
        get().pushToast({
          kind: 'success',
          title: 'Order completed',
          message: `${order.orderId.slice(0, 8)} · ${order.store}`,
        });
      } else {
        get().pushToast({
          kind: 'error',
          title: 'Order failed',
          message: order.failureReason ?? 'Unknown reason',
        });
      }
    }
  },

  setRecent(orders) {
    set({ recent: orders });
  },

  pushToast(toast) {
    const id = makeId();
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
  },

  dismissToast(id) {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));
