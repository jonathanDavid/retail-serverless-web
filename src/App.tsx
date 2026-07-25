import type { ReactNode } from 'react';
import { IS_DEMO_MODE, API_BASE_URL } from '@/api/client';
import { OrderForm } from '@/components/OrderForm';
import { OrdersBoard } from '@/components/OrdersBoard';
import { RecentOrders } from '@/components/RecentOrders';
import { Toaster } from '@/components/Toaster';

/**
 * Dashboard shell. Left column: order intake. Right column: the live board plus
 * a recent-orders panel. A banner makes DEMO vs. connected mode obvious.
 */
export function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-surface-border/70 bg-surface/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/15 ring-1 ring-brand/30">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-brand-soft" fill="none" aria-hidden="true">
                <path
                  d="M4 7h16l-1.2 9.6a2 2 0 0 1-2 1.4H7.2a2 2 0 0 1-2-1.4L4 7Zm4 0V6a4 4 0 1 1 8 0v1"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-100">
                Retail Serverless — Orders
              </h1>
              <p className="text-xs text-slate-500">
                Event-driven order pipeline · live status
              </p>
            </div>
          </div>
          <ModeBadge />
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <section className="space-y-6">
          <Panel title="New order" subtitle="POST /v1/orders → 202 Accepted">
            <OrderForm />
          </Panel>
          <Panel title="Recent orders" subtitle="GET /v1/orders">
            <RecentOrders />
          </Panel>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-slate-200">Live board</h2>
            <p className="text-xs text-slate-500">
              polling GET /v1/orders/:id every 500ms
            </p>
          </div>
          <OrdersBoard />
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-4 text-center text-xs text-slate-600 sm:px-6">
        Portfolio reconstruction by Jonathan Ilias · patterns shipped at Omnix IA
      </footer>

      <Toaster />
    </div>
  );
}

function ModeBadge() {
  if (IS_DEMO_MODE) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-300 ring-1 ring-inset ring-amber-400/30">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        Demo mode · simulated pipeline
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-400/30"
      title={API_BASE_URL}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      Connected
    </span>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface-raised/60 p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 font-mono text-[11px] text-slate-500">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}
