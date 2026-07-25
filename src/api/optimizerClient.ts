import type { Order } from '@/domain/types';
import { hashStringToSeed } from '@/lib/rng';
import type { PickupMetrics } from '@/lib/optimizerCompare';

/**
 * Optional integration with genetic-visualizer-api (feature-flagged by
 * VITE_OPTIMIZER_URL; the feature is invisible when unset — neither project
 * depends on the other).
 *
 * Flow (genetic/CONTRACT.md v2):
 *   1. POST /api/runs { problem:"pickup", problemConfig:{ seed, stores,
 *      products, needs }, ...GA params } → 201 { runId }
 *   2. WS /api/runs/:id/stream → per-generation messages; the FIRST
 *      `generation` renderSpec is the un-optimized baseline (best of the
 *      random initial population) and the final `done` renderSpec is the
 *      optimized solution. Same run ⇒ same scenario ⇒ fair comparison.
 *
 * The scenario is derived deterministically from a seed hashed from the
 * orderId, sized to the order (needs = line count), so no scenario endpoint
 * is required.
 */

export const OPTIMIZER_URL: string = (
  import.meta.env.VITE_OPTIMIZER_URL ?? ''
).replace(/\/+$/, '');

export const OPTIMIZER_ENABLED = OPTIMIZER_URL !== '';

export interface OptimizerResult {
  before: PickupMetrics;
  after: PickupMetrics;
  generations: number;
  elapsedMs: number | null;
}

interface PickupRenderSpec {
  selection: Record<string, string>;
  route: string[];
  routeKm: number;
  itemCostCents: number;
  storesUsed: number;
  travelMinutes: number;
}

interface GenerationPayload {
  gen: number;
  bestFitness: number;
  renderSpec: PickupRenderSpec;
  elapsedMs?: number;
}

interface StreamMessage {
  type: 'generation' | 'done' | 'error';
  payload: GenerationPayload & { message?: string };
}

const RUN_TIMEOUT_MS = 45_000;

function toMetrics(payload: GenerationPayload): PickupMetrics {
  const spec = payload.renderSpec;
  return {
    routeKm: spec.routeKm,
    itemCostCents: spec.itemCostCents,
    storesUsed: spec.storesUsed,
    travelMinutes: spec.travelMinutes,
    fitness: payload.bestFitness,
  };
}

function wsUrl(runId: string): string {
  const base = OPTIMIZER_URL.replace(/^http/, 'ws');
  return `${base}/api/runs/${encodeURIComponent(runId)}/stream`;
}

/** Start a pickup run for an order and resolve with baseline vs optimized. */
export async function optimizePickupForOrder(
  order: Order,
): Promise<OptimizerResult> {
  if (!OPTIMIZER_ENABLED) {
    throw new Error('Optimizer is not configured (VITE_OPTIMIZER_URL unset).');
  }

  const seed = hashStringToSeed(order.orderId) % 1_000_000;
  const needs = Math.min(Math.max(order.items.length, 3), 10);

  const res = await fetch(`${OPTIMIZER_URL}/api/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      problem: 'pickup',
      populationSize: 120,
      generations: 120,
      mutationRate: 0.05,
      crossoverRate: 0.9,
      elitism: 2,
      selection: 'tournament',
      seed,
      problemConfig: { seed, stores: 5, products: 16, needs },
    }),
  });

  if (!res.ok) {
    throw new Error(`Optimizer rejected the run (HTTP ${res.status}).`);
  }
  const { runId } = (await res.json()) as { runId: string };

  return consumeStream(runId);
}

function consumeStream(runId: string): Promise<OptimizerResult> {
  return new Promise<OptimizerResult>((resolve, reject) => {
    let socket: WebSocket;
    try {
      socket = new WebSocket(wsUrl(runId));
    } catch (err) {
      reject(
        err instanceof Error ? err : new Error('Could not open the stream.'),
      );
      return;
    }

    let first: GenerationPayload | null = null;
    let settled = false;

    const timeout = setTimeout(() => {
      fail(new Error('Optimizer run timed out.'));
    }, RUN_TIMEOUT_MS);

    function finish(result: OptimizerResult): void {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.close();
      resolve(result);
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

      if (msg.type === 'generation') {
        if (first === null) first = msg.payload;
      } else if (msg.type === 'done') {
        const baseline = first ?? msg.payload;
        finish({
          before: toMetrics(baseline),
          after: toMetrics(msg.payload),
          generations: msg.payload.gen,
          elapsedMs: msg.payload.elapsedMs ?? null,
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
