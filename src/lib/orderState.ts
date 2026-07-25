import type { CreateOrderRequest, OrderItem, OrderStatus } from '@/domain/types';
import { ORDER_STATUS_FLOW } from '@/domain/types';

/**
 * Pure order-state logic: the state machine that drives the per-order stepper,
 * total computation, and terminal detection. Kept free of React so it is
 * trivially unit-testable and reusable by the demo simulator.
 */

/** Terminal states never poll again. */
const TERMINAL: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  'completed',
  'failed',
]);

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL.has(status);
}

/** Server-authoritative total: sum(qty * unitPriceCents), in integer cents. */
export function computeTotalCents(items: readonly OrderItem[]): number {
  return items.reduce((sum, item) => {
    const qty = Number.isFinite(item.qty) ? item.qty : 0;
    const unit = Number.isFinite(item.unitPriceCents) ? item.unitPriceCents : 0;
    return sum + qty * unit;
  }, 0);
}

/**
 * The happy-path transitions of the pipeline. `failed` can be reached from any
 * transient state, so it is not encoded here — see {@link isValidTransition}.
 */
const NEXT_HAPPY: Record<OrderStatus, OrderStatus | null> = {
  received: 'queued',
  queued: 'processing',
  processing: 'completed',
  completed: null,
  failed: null,
};

/** The next happy-path state, or `null` when already terminal. */
export function nextHappyStatus(status: OrderStatus): OrderStatus | null {
  return NEXT_HAPPY[status];
}

/**
 * Whether `to` is a legal successor of `from`. Forward happy-path moves are
 * valid; a transient state may also fail. Backward / same-state moves are not.
 */
export function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (isTerminal(from)) return false;
  if (to === 'failed') return true;
  return NEXT_HAPPY[from] === to;
}

export type StepState = 'done' | 'active' | 'pending' | 'failed';

export interface Step {
  status: OrderStatus;
  label: string;
  state: StepState;
}

const STEP_LABELS: Record<(typeof ORDER_STATUS_FLOW)[number], string> = {
  received: 'Received',
  queued: 'Queued',
  processing: 'Processing',
  completed: 'Completed',
};

/**
 * Derive the stepper model for a given current status. The stepper renders the
 * four happy-path states; `failed` is surfaced by marking the state at which
 * the order stalled as `failed` (and everything after it `pending`).
 */
export function buildStepper(current: OrderStatus): Step[] {
  if (current === 'failed') {
    // The order failed somewhere in the transient phase. We don't get the exact
    // stall point from the status alone, so we mark `processing` (the last
    // transient step) as failed — the common case — and earlier steps as done.
    return ORDER_STATUS_FLOW.map((status) => {
      let state: StepState;
      if (status === 'completed') state = 'pending';
      else if (status === 'processing') state = 'failed';
      else state = 'done';
      return { status, label: STEP_LABELS[status], state };
    });
  }

  const currentIndex = ORDER_STATUS_FLOW.indexOf(
    current as (typeof ORDER_STATUS_FLOW)[number],
  );

  return ORDER_STATUS_FLOW.map((status, index) => {
    let state: StepState;
    if (index < currentIndex) state = 'done';
    else if (index === currentIndex) state = current === 'completed' ? 'done' : 'active';
    else state = 'pending';
    return { status, label: STEP_LABELS[status], state };
  });
}

/**
 * Progress ratio 0..1 for a status, useful for progress bars.
 * `failed` reports the progress reached before failing.
 */
export function progressRatio(status: OrderStatus): number {
  if (status === 'completed') return 1;
  if (status === 'failed') return 0.66; // stalled at ~processing
  const idx = ORDER_STATUS_FLOW.indexOf(
    status as (typeof ORDER_STATUS_FLOW)[number],
  );
  const lastIdx = ORDER_STATUS_FLOW.length - 1;
  return idx <= 0 ? 0 : idx / lastIdx;
}

/**
 * Next poll delay (ms) with light backoff. We poll aggressively at 500ms while
 * the order is fresh, easing off as it ages so a stuck order doesn't hammer the
 * API. Terminal orders return `null` (stop polling).
 */
export function nextPollDelayMs(
  status: OrderStatus,
  elapsedMs: number,
): number | null {
  if (isTerminal(status)) return null;
  if (elapsedMs < 10_000) return 500;
  if (elapsedMs < 30_000) return 1_000;
  if (elapsedMs < 60_000) return 2_000;
  return 5_000;
}

/** Lightweight client-side guard mirroring the API's zod validation. */
export function validateCreateOrder(req: CreateOrderRequest): string[] {
  const errors: string[] = [];
  if (!req.customer.name.trim()) errors.push('Customer name is required.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(req.customer.email)) {
    errors.push('A valid customer email is required.');
  }
  if (!req.store.trim()) errors.push('A store must be selected.');
  if (req.items.length === 0) errors.push('At least one line item is required.');
  req.items.forEach((item, i) => {
    if (!item.sku.trim()) errors.push(`Item ${i + 1}: SKU is required.`);
    if (!item.name.trim()) errors.push(`Item ${i + 1}: name is required.`);
    if (!Number.isInteger(item.qty) || item.qty <= 0) {
      errors.push(`Item ${i + 1}: quantity must be a positive integer.`);
    }
    if (!Number.isInteger(item.unitPriceCents) || item.unitPriceCents < 0) {
      errors.push(`Item ${i + 1}: unit price must be a non-negative amount.`);
    }
  });
  return errors;
}
