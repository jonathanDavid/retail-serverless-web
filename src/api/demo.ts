import type {
  CreateOrderRequest,
  CreateOrderResponse,
  HealthResponse,
  Order,
  OrderStatus,
} from '@/domain/types';
import { computeTotalCents, nextHappyStatus } from '@/lib/orderState';
import type { OrdersApi } from './orders';

/**
 * DEMO mode simulator.
 *
 * When VITE_API_URL is unset there is no AWS backend, so this module stands in
 * for the whole async pipeline: SQS enqueue, the process Lambda, inventory
 * reservation, DynamoDB persistence. An order is created in `received`, then a
 * chain of timers advances it received → queued → processing → completed
 * (or → failed ~15% of the time), mirroring what the real backend does
 * asynchronously. `getOrder`/`listOrders` just read the in-memory store, so the
 * polling UI exercises the exact same code path it would against real HTTP.
 */

const store = new Map<string, Order>();

/** Randomised per-hop latency so the stepper visibly moves, like a real queue. */
const HOP_DELAY_MS = { min: 700, max: 1600 };
const FAILURE_RATE = 0.15;

function randDelay(): number {
  return (
    HOP_DELAY_MS.min +
    Math.floor(Math.random() * (HOP_DELAY_MS.max - HOP_DELAY_MS.min))
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for non-secure contexts / older runtimes.
  return 'demo-' + Math.random().toString(36).slice(2, 10);
}

function transition(orderId: string, status: OrderStatus, reason?: string): void {
  const order = store.get(orderId);
  if (!order) return;
  order.status = status;
  order.updatedAt = nowIso();
  if (status === 'failed') {
    order.failureReason =
      reason ?? 'Inventory reservation failed (simulated DLQ path).';
  }
}

function advance(orderId: string): void {
  const order = store.get(orderId);
  if (!order) return;

  const next = nextHappyStatus(order.status);
  if (next === null) return; // terminal

  // When leaving `processing`, roll the dice: complete or fail.
  if (order.status === 'processing' && Math.random() < FAILURE_RATE) {
    transition(orderId, 'failed');
    return;
  }

  transition(orderId, next);
  if (next !== 'completed') {
    setTimeout(() => advance(orderId), randDelay());
  }
}

export const demoApi: OrdersApi = {
  createOrder(req: CreateOrderRequest): Promise<CreateOrderResponse> {
    const orderId = uuid();
    const createdAt = nowIso();
    const order: Order = {
      orderId,
      status: 'received',
      customer: req.customer,
      items: req.items,
      currency: 'COP',
      totalCents: computeTotalCents(req.items),
      store: req.store,
      createdAt,
      updatedAt: createdAt,
      failureReason: null,
    };
    store.set(orderId, order);

    // Kick off the simulated pipeline.
    setTimeout(() => advance(orderId), randDelay());

    return Promise.resolve({ orderId, status: 'received' });
  },

  getOrder(orderId: string): Promise<Order> {
    const order = store.get(orderId);
    if (!order) {
      return Promise.reject(
        Object.assign(new Error('Order not found'), { status: 404 }),
      );
    }
    // Return a shallow clone so callers can't mutate the store.
    return Promise.resolve({ ...order, items: [...order.items] });
  },

  listOrders(): Promise<Order[]> {
    const orders = [...store.values()]
      .map((o) => ({ ...o, items: [...o.items] }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return Promise.resolve(orders);
  },

  health(): Promise<HealthResponse> {
    return Promise.resolve({ ok: true });
  },
};
