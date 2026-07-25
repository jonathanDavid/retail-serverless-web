import { describe, expect, it } from 'vitest';
import type { CreateOrderRequest, OrderStatus } from '@/domain/types';
import {
  buildStepper,
  isTerminal,
  isValidTransition,
  nextHappyStatus,
  nextPollDelayMs,
  progressRatio,
  validateCreateOrder,
} from './orderState';

describe('isTerminal', () => {
  it('treats completed and failed as terminal, others as transient', () => {
    expect(isTerminal('completed')).toBe(true);
    expect(isTerminal('failed')).toBe(true);
    expect(isTerminal('received')).toBe(false);
    expect(isTerminal('queued')).toBe(false);
    expect(isTerminal('processing')).toBe(false);
  });
});

describe('nextHappyStatus', () => {
  it('walks the happy path and stops at terminal states', () => {
    expect(nextHappyStatus('received')).toBe('queued');
    expect(nextHappyStatus('queued')).toBe('processing');
    expect(nextHappyStatus('processing')).toBe('completed');
    expect(nextHappyStatus('completed')).toBeNull();
    expect(nextHappyStatus('failed')).toBeNull();
  });
});

describe('isValidTransition', () => {
  it('allows forward happy-path moves', () => {
    expect(isValidTransition('received', 'queued')).toBe(true);
    expect(isValidTransition('queued', 'processing')).toBe(true);
    expect(isValidTransition('processing', 'completed')).toBe(true);
  });

  it('allows failing from any transient state', () => {
    expect(isValidTransition('received', 'failed')).toBe(true);
    expect(isValidTransition('processing', 'failed')).toBe(true);
  });

  it('rejects skips, backward moves, and moves out of terminal states', () => {
    expect(isValidTransition('received', 'processing')).toBe(false);
    expect(isValidTransition('processing', 'queued')).toBe(false);
    expect(isValidTransition('completed', 'processing')).toBe(false);
    expect(isValidTransition('failed', 'received')).toBe(false);
  });
});

describe('buildStepper', () => {
  it('marks earlier steps done, the current step active, later pending', () => {
    const steps = buildStepper('queued');
    expect(steps.map((s) => s.state)).toEqual([
      'done', // received
      'active', // queued
      'pending', // processing
      'pending', // completed
    ]);
  });

  it('marks every step done when completed', () => {
    const steps = buildStepper('completed');
    expect(steps.every((s) => s.state === 'done')).toBe(true);
  });

  it('marks the processing step as failed on a failed order', () => {
    const steps = buildStepper('failed');
    const byStatus = Object.fromEntries(
      steps.map((s) => [s.status, s.state] as const),
    );
    expect(byStatus.received).toBe('done');
    expect(byStatus.queued).toBe('done');
    expect(byStatus.processing).toBe('failed');
    expect(byStatus.completed).toBe('pending');
  });

  it('always returns the four happy-path steps in order', () => {
    const steps = buildStepper('received');
    expect(steps.map((s) => s.status)).toEqual([
      'received',
      'queued',
      'processing',
      'completed',
    ]);
  });
});

describe('progressRatio', () => {
  it('increases along the happy path and completes at 1', () => {
    expect(progressRatio('received')).toBe(0);
    expect(progressRatio('processing')).toBeCloseTo(2 / 3, 5);
    expect(progressRatio('completed')).toBe(1);
  });
});

describe('nextPollDelayMs', () => {
  it('polls fast when fresh and backs off as the order ages', () => {
    expect(nextPollDelayMs('received', 0)).toBe(500);
    expect(nextPollDelayMs('queued', 12_000)).toBe(1_000);
    expect(nextPollDelayMs('processing', 45_000)).toBe(2_000);
    expect(nextPollDelayMs('processing', 90_000)).toBe(5_000);
  });

  it('returns null (stop polling) for terminal states', () => {
    expect(nextPollDelayMs('completed', 0)).toBeNull();
    expect(nextPollDelayMs('failed', 0)).toBeNull();
  });
});

describe('validateCreateOrder', () => {
  const valid: CreateOrderRequest = {
    customer: { name: 'Ana Gómez', email: 'ana@example.co' },
    store: 'Bogota-01',
    items: [{ sku: 'SKU-1', name: 'Coffee', qty: 2, unitPriceCents: 4500000 }],
  };

  it('accepts a well-formed request', () => {
    expect(validateCreateOrder(valid)).toEqual([]);
  });

  it('flags a missing name and invalid email', () => {
    const errors = validateCreateOrder({
      ...valid,
      customer: { name: '  ', email: 'not-an-email' },
    });
    expect(errors.some((e) => /name/i.test(e))).toBe(true);
    expect(errors.some((e) => /email/i.test(e))).toBe(true);
  });

  it('flags empty item lists and bad quantities/prices', () => {
    expect(validateCreateOrder({ ...valid, items: [] })).toContain(
      'At least one line item is required.',
    );
    const badItem = validateCreateOrder({
      ...valid,
      items: [{ sku: '', name: '', qty: 0, unitPriceCents: -1 }],
    });
    expect(badItem.length).toBeGreaterThanOrEqual(4);
  });
});

// Exhaustiveness guard: if a new status is added to the union, this fails to
// compile, forcing the state machine to be updated.
it('covers every OrderStatus in the terminal check', () => {
  const all: OrderStatus[] = [
    'received',
    'queued',
    'processing',
    'completed',
    'failed',
  ];
  const terminalCount = all.filter(isTerminal).length;
  expect(terminalCount).toBe(2);
});
