import { useState, type ReactNode } from 'react';
import { IS_DEMO_MODE, API_BASE_URL } from '@/api/client';
import { cartItemCount } from '@/demo/cart';
import { useDemoStore } from '@/store/demoStore';
import { CartPanel } from '@/components/cart/CartPanel';
import { DashboardWidgets } from '@/components/dashboard/DashboardWidgets';
import { InventoryBrowser } from '@/components/inventory/InventoryBrowser';
import { OrderForm } from '@/components/OrderForm';
import { OrdersBoard } from '@/components/OrdersBoard';
import { RecentOrders } from '@/components/RecentOrders';
import { Toaster } from '@/components/Toaster';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Term } from '@/components/ui/Tooltip';

/**
 * Dashboard shell.
 *
 * DEMO mode (no VITE_API_URL): the full product experience — dashboard
 * widgets, inventory browser, shopping cart, live board with fulfillment
 * plans. CONNECTED mode (VITE_API_URL set): the classic contract dashboard —
 * manual order form + live board + recent orders — untouched, since the real
 * API has no inventory endpoints.
 */
export function App() {
  return (
    <div className="min-h-screen">
      <Header />
      {IS_DEMO_MODE ? <DemoExperience /> : <ConnectedExperience />}
      <footer className="mx-auto max-w-7xl px-4 pb-10 pt-4 text-center text-xs text-slate-600 sm:px-6">
        Reconstrucción de portafolio por Jonathan Ilias · patrones de producción
        de Omnix IA
      </footer>
      <Toaster />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-surface-border/70 bg-surface/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/15 ring-1 ring-brand/30">
            <Icon name="store" className="h-5 w-5 text-brand-soft" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-slate-100">
              Retail Serverless — Pedidos
            </h1>
            <p className="text-xs text-slate-500">
              Tubería de pedidos event-driven · estado en vivo
            </p>
          </div>
        </div>
        <ModeBadge />
      </div>
    </header>
  );
}

function DemoExperience() {
  const cart = useDemoStore((s) => s.cart);
  const [showManual, setShowManual] = useState(false);
  const count = cartItemCount(cart);

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      {/* Widgets */}
      <section aria-label="Indicadores del negocio">
        <SectionHeading icon="chart" title="Panel de control" />
        <DashboardWidgets />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {/* Left: inventory + cart */}
        <div className="space-y-6">
          <section aria-label="Inventario">
            <Panel
              icon="box"
              title="Inventario"
              subtitle="catálogo simulado · 5 tiendas de Barranquilla"
            >
              <InventoryBrowser />
            </Panel>
          </section>

          <section aria-label="Carrito de compras">
            <Panel
              icon="cart"
              title={count > 0 ? `Carrito (${count})` : 'Carrito'}
              subtitle="POST /v1/orders → 202 Accepted"
            >
              <CartPanel />
              <div className="mt-4 border-t border-surface-border/60 pt-3">
                <button
                  type="button"
                  onClick={() => setShowManual((v) => !v)}
                  className="text-[11px] font-medium text-slate-500 underline decoration-dotted underline-offset-2 transition-colors hover:text-brand-soft"
                >
                  {showManual
                    ? 'Ocultar entrada manual'
                    : 'Entrada manual avanzada (SKUs a mano)'}
                </button>
                {showManual && (
                  <div className="mt-3">
                    <OrderForm />
                  </div>
                )}
              </div>
            </Panel>
          </section>
        </div>

        {/* Right: live board + recent */}
        <div className="space-y-6">
          <section aria-label="Pedidos en vivo">
            <div className="mb-3 flex items-center justify-between px-1">
              <SectionHeading icon="bolt" title="Pedidos en vivo" noMargin />
              <p className="text-[11px] text-slate-500">
                <Term term="polling" label="sondeo" /> cada 500ms ·{' '}
                <Term term="DLQ" /> ante fallos
              </p>
            </div>
            <OrdersBoard />
          </section>

          <section aria-label="Pedidos recientes">
            <Panel icon="list" title="Pedidos recientes" subtitle="GET /v1/orders">
              <RecentOrders />
            </Panel>
          </section>
        </div>
      </div>
    </main>
  );
}

function ConnectedExperience() {
  return (
    <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,420px)_1fr]">
      <div className="space-y-6">
        <section aria-label="Nuevo pedido">
          <Panel
            icon="cart"
            title="Nuevo pedido"
            subtitle="POST /v1/orders → 202 Accepted"
          >
            <OrderForm />
          </Panel>
        </section>
        <section aria-label="Pedidos recientes">
          <Panel icon="list" title="Pedidos recientes" subtitle="GET /v1/orders">
            <RecentOrders />
          </Panel>
        </section>
      </div>

      <section aria-label="Pedidos en vivo" className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <SectionHeading icon="bolt" title="Pedidos en vivo" noMargin />
          <p className="text-xs text-slate-500">
            sondeo GET /v1/orders/:id cada 500ms
          </p>
        </div>
        <OrdersBoard />
      </section>
    </main>
  );
}

function SectionHeading({
  icon,
  title,
  noMargin = false,
}: {
  icon: IconName;
  title: string;
  noMargin?: boolean;
}) {
  return (
    <h2
      className={`flex items-center gap-2 text-sm font-semibold text-slate-200 ${
        noMargin ? '' : 'mb-3 px-1'
      }`}
    >
      <Icon name={icon} className="h-4 w-4 text-brand-soft" />
      {title}
    </h2>
  );
}

function ModeBadge() {
  if (IS_DEMO_MODE) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-300 ring-1 ring-inset ring-amber-400/30">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
        Modo demo · tubería simulada
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-400/30"
      title={API_BASE_URL}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      Conectado
    </span>
  );
}

function Panel({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Icon name={icon} className="h-4 w-4 text-brand-soft" />
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 font-mono text-[11px] text-slate-500">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}
