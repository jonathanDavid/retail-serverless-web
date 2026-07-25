import type { OrderStatus } from '@/domain/types';
import { STATUS_STYLE } from '@/domain/constants';
import { isTerminal } from '@/lib/orderState';

interface Props {
  status: OrderStatus;
}

/** Small pill showing an order's current status, colour-coded per state. */
export function StatusBadge({ status }: Props) {
  const style = STATUS_STYLE[status];
  const animate = !isTerminal(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${style.badge}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${style.dot} ${
          animate ? 'animate-pulse' : ''
        }`}
      />
      {style.label}
    </span>
  );
}
