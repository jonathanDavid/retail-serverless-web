# retail-serverless-web

The dashboard for a **Retail Serverless Backend** — submit an order and watch it
move through an event-driven pipeline (`received → queued → processing →
completed / failed`) in real time.

> **Honesty note.** This is a **portfolio reconstruction** by Jonathan Ilias, not
> employer code. It re-implements — from scratch and from memory — the production
> patterns I shipped at **Omnix IA** (an event-driven retail backend: 20+ Lambdas,
> 100+ API Gateway endpoints, esbuild-optimized cold starts). It is one of three
> repos (`-web`, `-api`, `-infra`) that conform to a shared
> [architecture contract](../CONTRACT.md).

---

## Problem

A retail order arrives over HTTP. The backend accepts it **fast** (`202 Accepted`)
and does the real work **asynchronously**: enqueue to SQS, let a worker Lambda
reserve inventory and persist the order, then fan out a notification over SNS.
That is great for throughput and resilience, but it means the client never gets
the final result in the request that created the order.

So the dashboard has one core job: **make an asynchronous backend feel live**.
It submits an order, then tracks each one to a terminal state and visualizes the
state machine as it advances — without a socket server, and without a deployed
AWS backend being a prerequisite for a demo.

---

## Architecture (web ↔ API flow)

```mermaid
sequenceDiagram
    participant U as User
    participant W as Web (this repo)
    participant G as API Gateway
    participant I as ingest Lambda
    participant Q as SQS (orders)
    participant P as process Lambda
    participant D as DynamoDB

    U->>W: Fill order form, submit
    W->>G: POST /v1/orders {customer, items, store}
    G->>I: invoke
    I->>D: put Order status=received
    I->>Q: send {orderId}
    I-->>W: 202 {orderId, status:"received"}
    W->>W: optimistic card on live board

    loop poll every 500ms while non-terminal (backoff as it ages)
        W->>G: GET /v1/orders/:id
        G-->>W: Order (current state)
        W->>W: advance stepper; toast on terminal
    end

    Q->>P: deliver {orderId}
    P->>D: status=processing → completed/failed
    Note over P,D: failures land in orders-dlq (maxReceiveCount 3)
```

**Client-side shape**

```
src/
  domain/      types transcribed from the contract + shared constants
  api/         typed client (client.ts) · route functions (orders.ts) · demo simulator (demo.ts)
  lib/         pure logic: money.ts (COP cents) · orderState.ts (state machine, stepper, polling cadence)
  store/       ordersStore.ts — small Zustand store (tracked orders, recent list, toasts)
  hooks/       useOrderPolling.ts — per-order polling loop with backoff
  components/  OrderForm · OrdersBoard/OrderCard · StateStepper · RecentOrders · Toaster
```

The API layer mirrors the contract routes exactly and is the only thing that
touches `fetch`. Everything the UI depends on — totals, formatting, the state
machine — lives as pure functions in `lib/`, which is why the tests are fast and
the components stay dumb.

---

## Key decisions & trade-offs

| Decision | Choice | Why / trade-off |
| --- | --- | --- |
| **Live status transport** | **Polling** `GET /orders/:id` at 500ms, backing off to 5s as an order ages, stopping on terminal | The pipeline is short-lived (seconds) and each order self-terminates, so a bounded poll is simpler and cheaper than standing up WebSocket/AppSync infra. Backoff keeps a stuck order from hammering the API; terminal detection stops the loop entirely. Trade-off: not instant, and it costs one request per tick — fine at this scale, not at fan-out scale (see below). |
| **Submit UX** | **Optimistic** card on `202` | The contract's whole point is "accept fast". I render the card the instant the API returns `202 { orderId }` and let polling reconcile it, so the board feels immediate. Trade-off: the optimistic card shows `received` before the server confirms; the first poll corrects it. |
| **State model** | Pure state machine in `lib/orderState.ts` | `received→queued→processing→completed/failed` lives in one testable module that drives the stepper, the poll cadence, and terminal toasts. No status logic leaks into components. |
| **Money** | Integer **cents**, `es-CO` `COP` formatting via `Intl` | Amounts are never floats — the API stores cents, the web mirrors it, and `Intl.NumberFormat('es-CO', { currency: 'COP' })` handles grouping. Totals are computed the same way the server does: `sum(qty * unitPriceCents)`. |
| **State management** | **Zustand** | Two small collections + toasts. Redux would be ceremony; prop-drilling would be noise. Zustand selectors keep re-renders tight. |
| **Demo mode** | Simulate the pipeline client-side when `VITE_API_URL` is unset | A portfolio site must be demoable with zero infra. `api/demo.ts` stands in for SQS + the process Lambda, advancing orders on timers through the **same** `OrdersApi` interface — so the polling UI runs identical code with or without AWS. |
| **Error surface** | Typed `ApiError` mirroring `{ error, message }` | The contract's error envelope is decoded once in `client.ts`; the UI shows `code: message` in a toast rather than a raw stack. |

---

## What I'd change at scale

- **Push instead of poll.** Beyond a handful of concurrent orders, per-order
  polling is wasteful. I'd move status to **WebSocket API Gateway** or **AppSync
  subscriptions**, with the `process` Lambda publishing state changes (it already
  emits SNS on terminal states — extend that to every transition). Polling stays
  as a graceful-degradation fallback.
- **Pagination + filtering** on `GET /orders`. Today it's a capped recent list;
  at volume it needs cursor pagination over the recent-orders GSI, plus filters
  by store/status/date.
- **Auth.** Add Cognito (or the org IdP) in front of API Gateway; scope orders to
  a tenant/store and drop a JWT on every request from a typed auth layer.
- **Resilience.** Surface DLQ/retry state in the UI, add request-level retry with
  jitter, and idempotency keys on submit so a double-click can't double-order.
- **Observability.** RUM + a correlation id echoed from the API so a card links
  straight to its CloudWatch trace.

---

## Local dev quickstart

Requires Node 20+.

```bash
npm install

# Demo mode (no backend needed) — the pipeline is simulated client-side:
npm run dev

# Connected mode — point at a deployed retail-serverless-api:
cp .env.example .env      # then set VITE_API_URL=https://<api-id>.execute-api.<region>.amazonaws.com/v1
npm run dev

npm test            # Vitest: COP money, order state machine/stepper, total computation
npm run build       # type-check (tsc --noEmit) + vite build → dist/
npm run lint        # ESLint (typed)
```

Container parity with the other repos:

```bash
docker build -t retail-serverless-web \
  --build-arg VITE_API_URL="https://<api-id>.execute-api.<region>.amazonaws.com/v1" .
docker run --rm -p 8080:80 retail-serverless-web   # → http://localhost:8080
```

---

_Author: Jonathan Ilias — Senior Full Stack & Cloud Engineer · jdavid.ilias@gmail.com_
