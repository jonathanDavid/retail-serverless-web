import type { Order } from '@/domain/types';
import type { DemoWorld } from '@/demo/inventory';
import {
  buildScenario,
  hasOptimizationHeadroom,
  metricsForSelection,
  naiveBaseline,
  unstockedSkus,
  type PickupScenario,
  type Selection,
} from '@/demo/scenario';
import { totalCostCents, type PickupMetrics } from '@/lib/optimizerCompare';

/**
 * Optional integration with genetic-visualizer-api (feature-flagged by
 * VITE_OPTIMIZER_URL; the feature is invisible when unset — neither project
 * depends on the other).
 *
 * It optimizes the REAL order against the REAL store inventory:
 *   1. Build an explicit pickup scenario from the order's items + the demo
 *      world's stores/prices/stock (genetic/CONTRACT.md → "Custom scenario").
 *   2. If no item is available in ≥2 stores there is no headroom — return
 *      "already optimal" without troubling the optimizer.
 *   3. Otherwise POST /api/runs { problem:"pickup", problemConfig:{ scenario } }
 *      and read the WS stream to the final `done` renderSpec = the optimized
 *      plan. The "sin optimizar" baseline is computed LOCALLY (naive per-item
 *      nearest store), and both plans are scored with the same cost model.
 */

export const OPTIMIZER_URL: string = (
  import.meta.env.VITE_OPTIMIZER_URL ?? ''
).replace(/\/+$/, '');

export const OPTIMIZER_ENABLED = OPTIMIZER_URL !== '';

export type OptimizerOutcome =
  | {
      kind: 'already-optimal';
      scenario: PickupScenario;
      plan: PickupMetrics;
      /** `single-store` = no headroom; `no-gain` = GA couldn't beat naive. */
      reason: 'single-store' | 'no-gain';
    }
  | {
      kind: 'compared';
      scenario: PickupScenario;
      before: PickupMetrics;
      after: PickupMetrics;
      generations: number;
      elapsedMs: number | null;
    };

interface PickupRenderSpec {
  selection: Record<string, string>;
  route: string[];
  routeKm: number;
  itemCostCents: number;
  storesUsed: number;
  travelMinutes: number;
}

interface DonePayload {
  gen: number;
  renderSpec: PickupRenderSpec;
  elapsedMs?: number;
}

interface StreamMessage {
  type: 'generation' | 'done' | 'error';
  payload: Partial<DonePayload> & { message?: string };
}

const RUN_TIMEOUT_MS = 45_000;

function wsUrl(runId: string): string {
  const base = OPTIMIZER_URL.replace(/^http/, 'ws');
  return `${base}/api/runs/${encodeURIComponent(runId)}/stream`;
}

/**
 * Derive optimized metrics from the GA's `done` renderSpec. When the returned
 * selection is complete and valid we re-score it with our own model (identical
 * to the baseline's math); otherwise we trust the renderSpec's own numbers.
 */
function optimizedMetrics(
  scenario: PickupScenario,
  spec: PickupRenderSpec,
): PickupMetrics {
  const entries = Object.entries(spec.selection ?? {});
  const selection: Selection = new Map(entries);
  const coversAll = scenario.shoppingList.every((i) => selection.has(i.sku));
  const validStores = [...selection.values()].every((id) =>
    scenario.stores.some((s) => s.id === id),
  );
  if (coversAll && validStores) {
    return metricsForSelection(scenario, selection);
  }
  return {
    routeKm: spec.routeKm,
    itemCostCents: spec.itemCostCents,
    storesUsed: spec.storesUsed,
    travelMinutes: spec.travelMinutes,
  };
}

/** Optimize a real order's pickup. Throws on transport/validation failure. */
export async function optimizePickupForOrder(
  order: Order,
  world: DemoWorld,
): Promise<OptimizerOutcome> {
  if (!OPTIMIZER_ENABLED) {
    throw new Error('Optimizer is not configured (VITE_OPTIMIZER_URL unset).');
  }

  const scenario = buildScenario(world, order.items);

  const missing = unstockedSkus(scenario);
  if (missing.length > 0) {
    throw new Error(
      `El inventario ya no cubre ${missing.length} artículo(s) del pedido.`,
    );
  }

  const before = naiveBaseline(scenario);

  // No item has an alternative store ⇒ every choice is forced ⇒ already optimal.
  if (!hasOptimizationHeadroom(scenario)) {
    return { kind: 'already-optimal', scenario, plan: before, reason: 'single-store' };
  }

  const spec = await runPickup(scenario);
  const after = optimizedMetrics(scenario, spec.renderSpec);

  // Honesty guard: if the GA couldn't beat the naive plan, say so rather than
  // showing a fake "−0%".
  if (totalCostCents(after) >= totalCostCents(before)) {
    return { kind: 'already-optimal', scenario, plan: before, reason: 'no-gain' };
  }

  return {
    kind: 'compared',
    scenario,
    before,
    after,
    generations: spec.gen,
    elapsedMs: spec.elapsedMs ?? null,
  };
}

async function runPickup(scenario: PickupScenario): Promise<DonePayload> {
  const res = await fetch(`${OPTIMIZER_URL}/api/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      problem: 'pickup',
      populationSize: 120,
      generations: 150,
      mutationRate: 0.06,
      crossoverRate: 0.9,
      elitism: 2,
      selection: 'tournament',
      problemConfig: { scenario },
    }),
  });

  if (!res.ok) {
    throw new Error(`Optimizer rejected the run (HTTP ${res.status}).`);
  }
  const { runId } = (await res.json()) as { runId: string };
  return consumeStream(runId);
}

function consumeStream(runId: string): Promise<DonePayload> {
  return new Promise<DonePayload>((resolve, reject) => {
    let socket: WebSocket;
    try {
      socket = new WebSocket(wsUrl(runId));
    } catch (err) {
      reject(err instanceof Error ? err : new Error('Could not open the stream.'));
      return;
    }

    let settled = false;
    const timeout = setTimeout(() => {
      fail(new Error('Optimizer run timed out.'));
    }, RUN_TIMEOUT_MS);

    function finish(payload: DonePayload): void {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.close();
      resolve(payload);
    }

    function fail(err: Error): void {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        socket.close();
      } catch {
        /* already closed */
      }
      reject(err);
    }

    socket.onmessage = (event: MessageEvent<string>) => {
      let msg: StreamMessage;
      try {
        msg = JSON.parse(event.data) as StreamMessage;
      } catch {
        return; // ignore malformed frames
      }
      if (msg.type === 'done' && msg.payload.renderSpec) {
        finish({
          gen: msg.payload.gen ?? 0,
          renderSpec: msg.payload.renderSpec,
          elapsedMs: msg.payload.elapsedMs,
        });
      } else if (msg.type === 'error') {
        fail(new Error(msg.payload.message ?? 'Optimizer reported an error.'));
      }
    };

    socket.onerror = () => {
      fail(new Error('Stream connection failed — is the optimizer running?'));
    };

    socket.onclose = () => {
      fail(new Error('Stream closed before the run finished.'));
    };
  });
}
