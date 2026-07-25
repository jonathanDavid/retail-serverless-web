/** Loading placeholders shown while the inventory "reseeds". */

export function SkeletonLine({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-slate-700/40 ${className}`}
      aria-hidden="true"
    />
  );
}

export function InventorySkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2.5" role="status" aria-label="Cargando inventario">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border border-surface-border/40 p-3"
        >
          <SkeletonLine className="h-9 w-9 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <SkeletonLine className="h-3 w-2/5" />
            <SkeletonLine className="h-2.5 w-1/4" />
          </div>
          <SkeletonLine className="h-5 w-16 rounded-full" />
          <SkeletonLine className="h-7 w-7 rounded-lg" />
        </div>
      ))}
      <span className="sr-only">Cargando inventario…</span>
    </div>
  );
}
