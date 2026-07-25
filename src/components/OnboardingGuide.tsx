import { useState } from 'react';
import { Icon, type IconName } from './ui/Icon';

/**
 * A short "how to test this demo" guide shown at the top of the dashboard so a
 * first-time visitor knows what the app showcases and how to drive it.
 * Dismissible; the choice is remembered in localStorage.
 */

const STORAGE_KEY = 'rsw:onboarding-dismissed:v1';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function persistDismissed(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* private mode / storage disabled — non-fatal */
  }
}

const STEPS: { icon: IconName; text: string }[] = [
  { icon: 'cart', text: 'Agrega productos al carrito' },
  { icon: 'bolt', text: 'Pulsa «Realizar pedido»' },
  { icon: 'route', text: 'Mira el flujo recibido → procesando → completado' },
  { icon: 'store', text: 'Descubre qué tiendas lo cumplen' },
  { icon: 'spark', text: 'Opcional: «Optimizar recogida»' },
];

export function OnboardingGuide() {
  const [dismissed, setDismissed] = useState(readDismissed);

  if (dismissed) return null;

  function dismiss(): void {
    persistDismissed();
    setDismissed(true);
  }

  return (
    <aside
      aria-label="Guía rápida del demo"
      className="glass animate-fade-in-up relative overflow-hidden rounded-2xl p-5"
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand/10 blur-3xl"
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={dismiss}
        aria-label="Descartar la guía"
        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-200"
      >
        <Icon name="x" className="h-4 w-4" />
      </button>

      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/15 text-brand-soft ring-1 ring-inset ring-brand/30">
          <Icon name="spark" className="h-5 w-5" />
        </span>
        <div className="pr-6">
          <h2 className="text-sm font-semibold text-slate-100">
            Prueba el demo en 30 segundos
          </h2>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
            Simula una <strong className="font-semibold text-slate-300">tubería
            de pedidos serverless y event-driven</strong> con planificación de
            cumplimiento por tienda. Todo corre en tu navegador.
          </p>
        </div>
      </div>

      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {STEPS.map((step, i) => (
          <li
            key={step.text}
            className="flex items-center gap-2 rounded-lg border border-surface-border/50 bg-surface/50 p-2.5"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/15 text-[11px] font-bold text-brand-soft">
              {i + 1}
            </span>
            <span className="flex items-center gap-1.5 text-[11px] leading-tight text-slate-300">
              <Icon name={step.icon} className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              {step.text}
            </span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
