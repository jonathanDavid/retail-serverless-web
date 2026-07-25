import { useEffect } from 'react';
import type { Toast } from '@/store/ordersStore';
import { useOrdersStore } from '@/store/ordersStore';

const KIND_STYLE: Record<Toast['kind'], string> = {
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100',
  error: 'border-rose-500/40 bg-rose-500/10 text-rose-100',
  info: 'border-sky-500/40 bg-sky-500/10 text-sky-100',
};

const AUTO_DISMISS_MS = 5_000;

/** Fixed-position toast stack. Terminal-state and error feedback lands here. */
export function Toaster() {
  const toasts = useOrdersStore((s) => s.toasts);
  const dismiss = useOrdersStore((s) => s.dismissToast);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      role="status"
      className={`pointer-events-auto animate-fade-in-up rounded-lg border px-4 py-3 shadow-lg backdrop-blur ${KIND_STYLE[toast.kind]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{toast.title}</p>
          {toast.message && (
            <p className="mt-0.5 truncate text-xs opacity-80">{toast.message}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notification"
          className="shrink-0 text-current opacity-60 transition-opacity hover:opacity-100"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
