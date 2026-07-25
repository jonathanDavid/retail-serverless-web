import type { ReactNode } from 'react';
import { Icon } from './Icon';

/**
 * Zero-dependency hover/focus tooltip plus a glossary of pipeline jargon so
 * visitors who don't live in AWS all day can follow the story.
 */

export const GLOSSARY = {
  '202': 'HTTP 202 Accepted: the API takes the order and answers immediately — the real work happens asynchronously afterwards.',
  SQS: 'Amazon Simple Queue Service: the buffer between accepting an order and processing it. The ingest Lambda enqueues; a worker Lambda consumes.',
  DLQ: 'Dead-Letter Queue: after 3 failed processing attempts a message lands here and raises a CloudWatch alarm instead of retrying forever.',
  polling: 'The dashboard asks GET /orders/:id every 500ms while the order is in flight, easing off over time and stopping once it reaches a terminal state.',
  Lambda: 'AWS Lambda: serverless functions billed per invocation — the ingest, process, and status handlers of this backend.',
} as const;

export type GlossaryTerm = keyof typeof GLOSSARY;

interface TooltipProps {
  text: string;
  children: ReactNode;
}

export function Tooltip({ text, children }: TooltipProps) {
  return (
    <span className="group/tip relative inline-flex" tabIndex={0}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 w-60 -translate-x-1/2 rounded-lg border border-surface-border bg-surface px-3 py-2 text-left text-[11px] font-normal normal-case leading-relaxed tracking-normal text-slate-300 opacity-0 shadow-xl transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

/** Dotted-underline term that reveals its glossary definition on hover. */
export function Term({ term, label }: { term: GlossaryTerm; label?: string }) {
  return (
    <Tooltip text={GLOSSARY[term]}>
      <span className="inline-flex cursor-help items-center gap-0.5 underline decoration-dotted decoration-slate-500 underline-offset-2">
        {label ?? term}
        <Icon name="info" className="h-3 w-3 opacity-60" />
      </span>
    </Tooltip>
  );
}
