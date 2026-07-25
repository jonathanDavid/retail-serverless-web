import type { OrderStatus } from '@/domain/types';
import { buildStepper, type StepState } from '@/lib/orderState';

interface Props {
  status: OrderStatus;
}

const NODE_CLASS: Record<StepState, string> = {
  done: 'border-emerald-400 bg-emerald-400 text-slate-900',
  active: 'border-brand bg-brand text-white animate-pulse-ring',
  pending: 'border-surface-border bg-surface-raised text-slate-500',
  failed: 'border-rose-400 bg-rose-500 text-white',
};

const LABEL_CLASS: Record<StepState, string> = {
  done: 'text-emerald-300',
  active: 'text-brand-soft',
  pending: 'text-slate-500',
  failed: 'text-rose-300',
};

const CONNECTOR_CLASS: Record<StepState, string> = {
  done: 'bg-emerald-400',
  active: 'bg-brand/60',
  pending: 'bg-surface-border',
  failed: 'bg-rose-500/60',
};

/**
 * Per-order state-machine visualization: the four happy-path states as a
 * horizontal stepper that lights up as the order advances. A `failed` order
 * marks its stalled step in rose.
 */
export function StateStepper({ status }: Props) {
  const steps = buildStepper(status);

  return (
    <ol className="flex items-center" aria-label="Order pipeline progress">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <li
            key={step.status}
            className={`flex items-center ${isLast ? '' : 'flex-1'}`}
          >
            <div className="flex flex-col items-center gap-1">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${NODE_CLASS[step.state]}`}
                aria-current={step.state === 'active' ? 'step' : undefined}
              >
                {step.state === 'done' ? (
                  <CheckIcon />
                ) : step.state === 'failed' ? (
                  <XIcon />
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={`whitespace-nowrap text-[10px] font-medium uppercase tracking-wide ${LABEL_CLASS[step.state]}`}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <span
                className={`mx-1 mb-4 h-0.5 flex-1 rounded transition-colors ${CONNECTOR_CLASS[step.state]}`}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <path
        d="M3.5 8.5l3 3 6-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <path
        d="M4 4l8 8M12 4l-8 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
