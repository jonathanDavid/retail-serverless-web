import { useMemo, useState } from 'react';
import { CATEGORIES, type Category } from '@/demo/catalog';
import {
  aggregateStatus,
  bestPriceCents,
  entriesForSku,
  sellableUnits,
  totalSellable,
} from '@/demo/inventory';
import { formatCentsCOP } from '@/lib/money';
import { useDemoStore } from '@/store/demoStore';
import { Icon } from '@/components/ui/Icon';
import { InventorySkeleton } from '@/components/ui/Skeleton';
import { Tooltip } from '@/components/ui/Tooltip';
import { StockBadge } from './StockBadge';

type SortKey = 'name' | 'price' | 'stock';

const PAGE_SIZE = 7;

/**
 * The catalog browser: search, category filter, sort, pagination, per-product
 * availability chips, and one-click add-to-cart. "Actualizar inventario"
 * reseeds the demo world behind a loading skeleton.
 */
export function InventoryBrowser() {
  const world = useDemoStore((s) => s.world);
  const reseeding = useDemoStore((s) => s.reseeding);
  const reseed = useDemoStore((s) => s.reseed);
  const addSkuToCart = useDemoStore((s) => s.addSkuToCart);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = world.products.filter((p) => {
      if (category !== 'all' && p.category !== category) return false;
      if (q === '') return true;
      return (
        p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
      );
    });

    const withMeta = filtered.map((p) => ({
      product: p,
      price: bestPriceCents(world, p.sku),
      sellable: totalSellable(world, p.sku),
      status: aggregateStatus(entriesForSku(world, p.sku)),
    }));

    withMeta.sort((a, b) => {
      switch (sortKey) {
        case 'price':
          return (a.price ?? Number.MAX_SAFE_INTEGER) - (b.price ?? Number.MAX_SAFE_INTEGER);
        case 'stock':
          return b.sellable - a.sellable;
        case 'name':
          return a.product.name.localeCompare(b.product.name, 'es');
      }
    });
    return withMeta;
  }, [world, query, category, sortKey]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  function resetPage(): void {
    setPage(0);
  }

  return (
    <div>
      {/* Controls */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Buscar producto</span>
          <Icon
            name="search"
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500"
          />
          <input
            className="w-full rounded-lg border border-surface-border bg-surface py-1.5 pl-8 pr-3 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition-colors focus:border-brand focus:ring-1 focus:ring-brand"
            placeholder="Buscar por nombre o SKU…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              resetPage();
            }}
          />
        </label>
        <select
          aria-label="Filtrar por categoría"
          className="rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-brand"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value as Category | 'all');
            resetPage();
          }}
        >
          <option value="all">Todas las categorías</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          aria-label="Ordenar por"
          className="rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-brand"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
        >
          <option value="name">Nombre</option>
          <option value="price">Precio</option>
          <option value="stock">Stock</option>
        </select>
        <button
          type="button"
          onClick={reseed}
          disabled={reseeding}
          className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-all hover:border-brand/60 hover:text-brand-soft disabled:opacity-50"
        >
          <Icon
            name="refresh"
            className={`h-3.5 w-3.5 ${reseeding ? 'animate-spin' : ''}`}
          />
          Actualizar inventario
        </button>
      </div>

      {/* Rows */}
      {reseeding ? (
        <InventorySkeleton rows={PAGE_SIZE} />
      ) : pageRows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-surface-border px-4 py-8 text-center text-xs text-slate-500">
          Ningún producto coincide con la búsqueda.
        </p>
      ) : (
        <ul className="space-y-2">
          {pageRows.map(({ product, price, sellable, status }) => {
            const perStore = entriesForSku(world, product.sku);
            const breakdown = perStore
              .map((e) => {
                const store = world.stores.find((s) => s.id === e.storeId);
                return `${store?.name ?? e.storeId}: ${sellableUnits(e)} uds`;
              })
              .join(' · ');
            return (
              <li
                key={product.sku}
                className="group flex items-center gap-3 rounded-lg border border-surface-border/50 bg-surface/60 p-3 transition-all hover:-translate-y-px hover:border-brand/40 hover:shadow-lg hover:shadow-brand/5"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand-soft ring-1 ring-inset ring-brand/20">
                  <Icon name="box" className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-200">
                    {product.name}
                  </p>
                  <p className="truncate text-[11px] text-slate-500">
                    {product.sku} · {product.category}
                  </p>
                </div>
                <Tooltip text={breakdown || 'Sin existencias'}>
                  <span className="hidden cursor-help text-right text-[11px] text-slate-400 sm:block">
                    {sellable} uds
                    <span className="block text-slate-600">en red</span>
                  </span>
                </Tooltip>
                <div className="hidden w-24 text-right sm:block">
                  {price !== null ? (
                    <>
                      <p className="text-sm font-semibold text-slate-100">
                        {formatCentsCOP(price)}
                      </p>
                      <p className="text-[10px] text-slate-600">mejor precio</p>
                    </>
                  ) : (
                    <p className="text-xs text-slate-600">—</p>
                  )}
                </div>
                <StockBadge status={status} />
                <button
                  type="button"
                  onClick={() => addSkuToCart(product.sku)}
                  disabled={status === 'out' || status === 'reserved'}
                  aria-label={`Agregar ${product.name} al carrito`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/15 text-brand-soft ring-1 ring-inset ring-brand/30 transition-all hover:bg-brand hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Icon name="plus" className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Pagination */}
      {!reseeding && rows.length > PAGE_SIZE && (
        <nav
          className="mt-3 flex items-center justify-between text-xs text-slate-500"
          aria-label="Paginación del inventario"
        >
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors hover:text-slate-200 disabled:opacity-30"
          >
            <Icon name="chevron-left" className="h-3.5 w-3.5" /> Anterior
          </button>
          <span>
            Página {safePage + 1} de {pageCount} · {rows.length} productos
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={safePage >= pageCount - 1}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors hover:text-slate-200 disabled:opacity-30"
          >
            Siguiente <Icon name="chevron-right" className="h-3.5 w-3.5" />
          </button>
        </nav>
      )}
    </div>
  );
}
