import { STORES } from '@/domain/constants';

interface Props {
  value: string;
  onChange: (store: string) => void;
  id?: string;
}

/** Dropdown of demo stores → maps to the order's `store` field. */
export function StoreSelector({ value, onChange, id = 'store' }: Props) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand"
    >
      {STORES.map((store) => (
        <option key={store} value={store}>
          {store}
        </option>
      ))}
    </select>
  );
}
