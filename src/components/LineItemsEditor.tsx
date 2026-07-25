import type { OrderItem } from '@/domain/types';
import { formatCentsCOP } from '@/lib/money';

interface Props {
  items: OrderItem[];
  onChange: (items: OrderItem[]) => void;
}

const inputClass =
  'w-full rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand';

/**
 * Editable table of order line items. Prices are entered in whole COP pesos and
 * stored as integer cents (peso × 100); a live es-CO COP preview reinforces the
 * conversion.
 */
export function LineItemsEditor({ items, onChange }: Props) {
  function update(index: number, patch: Partial<OrderItem>): void {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function remove(index: number): void {
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <div className="hidden grid-cols-[1fr_1.4fr_4rem_1fr_1.5rem] gap-2 px-1 text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:grid">
        <span>SKU</span>
        <span>Name</span>
        <span>Qty</span>
        <span>Unit price (COP)</span>
        <span />
      </div>

      {items.map((item, index) => {
        const pesos = Math.round(item.unitPriceCents / 100);
        return (
          <div
            key={index}
            className="grid grid-cols-2 gap-2 rounded-lg border border-surface-border/60 bg-surface-raised/40 p-2 sm:grid-cols-[1fr_1.4fr_4rem_1fr_1.5rem] sm:border-0 sm:bg-transparent sm:p-0"
          >
            <input
              className={inputClass}
              placeholder="SKU-001"
              aria-label={`Item ${index + 1} SKU`}
              value={item.sku}
              onChange={(e) => update(index, { sku: e.target.value })}
            />
            <input
              className={inputClass}
              placeholder="Product name"
              aria-label={`Item ${index + 1} name`}
              value={item.name}
              onChange={(e) => update(index, { name: e.target.value })}
            />
            <input
              className={inputClass}
              type="number"
              min={1}
              step={1}
              aria-label={`Item ${index + 1} quantity`}
              value={item.qty}
              onChange={(e) =>
                update(index, { qty: Math.max(0, Math.trunc(+e.target.value)) })
              }
            />
            <div>
              <input
                className={inputClass}
                type="number"
                min={0}
                step={100}
                aria-label={`Item ${index + 1} unit price in pesos`}
                value={pesos}
                onChange={(e) =>
                  update(index, {
                    unitPriceCents: Math.max(0, Math.trunc(+e.target.value)) * 100,
                  })
                }
              />
              <p className="mt-0.5 hidden text-right text-[10px] text-slate-500 sm:block">
                {formatCentsCOP(item.unitPriceCents)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => remove(index)}
              disabled={items.length === 1}
              aria-label={`Remove item ${index + 1}`}
              className="flex items-center justify-center rounded-lg text-slate-500 transition-colors hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-30"
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
        );
      })}
    </div>
  );
}
