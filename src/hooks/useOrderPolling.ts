import { useEffect } from 'react';
import type { OrderStatus } from '@/domain/types';
import { ordersApi } from '@/api/orders';
import { isTerminal, nextPollDelayMs } from '@/lib/orderState';
import { useOrdersStore } from '@/store/ordersStore';

/**
 * Polls `GET /v1/orders/:id` for a single order while it is non-terminal.
 *
 * Cadence comes from {@link nextPollDelayMs}: 500ms while fresh, easing to 5s as
 * the order ages (backoff), and `null` once terminal — at which point polling
 * stops entirely. Each fetch reconciles into the store, which is what advances
 * the card's stepper and fires terminal toasts. In-flight requests are aborted
 * on unmount.
 *
 * This is the web half of the contract's async loop:
 *   Web ◀── GET /orders/:id (poll status) ── API Gateway ◀── status Lambda
 */
export function useOrderPolling(
  orderId: string,
  initialStatus: OrderStatus,
  createdAt: string,
): void {
  const reconcileOrder = useOrdersStore((s) => s.reconcileOrder);
  const pushToast = useOrdersStore((s) => s.pushToast);

  useEffect(() => {
    if (isTerminal(initialStatus)) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let consecutiveErrors = 0;
    const controller = new AbortController();
    const startedAt = new Date(createdAt).getTime();

    const tick = async (): Promise<void> => {
      try {
        const order = await ordersApi.getOrder(orderId, controller.signal);
        if (cancelled) return;
        consecutiveErrors = 0;
        reconcileOrder(order);

        const delay = nextPollDelayMs(order.status, Date.now() - startedAt);
        if (delay !== null) {
          timer = setTimeout(() => void tick(), delay);
        }
      } catch (err) {
        if (cancelled || controller.signal.aborted) return;
        consecutiveErrors += 1;
        // Surface a one-off toast if the API keeps failing, then keep retrying
        // with a fixed backoff — a transient 5xx shouldn't kill the card.
        if (consecutiveErrors === 3) {
          pushToast({
            kind: 'error',
            title: 'Status polling degraded',
            message: `Retrying ${orderId.slice(0, 8)}…`,
          });
        }
        timer = setTimeout(() => void tick(), 2_000);
      }
    };

    timer = setTimeout(() => void tick(), 500);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      controller.abort();
    };
    // Intentionally keyed on orderId only: the loop reads live status from each
    // response, so it neither needs nor wants to restart on every transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);
}
