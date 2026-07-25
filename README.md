# retail-serverless-web

The dashboard for a **Retail Serverless Backend** — browse a multi-store inventory, build a
cart, submit the order, and watch it move through an event-driven pipeline (`received →
queued → processing → completed / failed`) in real time, ending in a per-store fulfillment
plan with a pickup route.

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

So the dashboard has two jobs:

1. **Make an asynchronous backend feel live** — track every order to a terminal
   state and animate the state machine as it advances, without a socket server.
2. **Feel like a real retail product, not a form** — in demo mode it simulates a
   small retail operation end to end: seeded inventory across five
   Barranquilla stores, a shopping cart, per-store fulfillment planning with a
   pickup route, and business widgets that react to every completed order.

## The product experience (demo mode)

When `VITE_API_URL` is unset, the whole pipeline AND a retail world are simulated
client-side, deterministically from a seed:

- **Simulated inventory** — 5 stores × 19 grocery products, each store × product
  cell with its own stock, reservations, and COP price (base ± 12%, snapped to
  50-peso steps). Status chips: *Disponible*, *Stock bajo* (≤10 sellable),
  *Agotado*, *Reservado*. "Actualizar inventario" reseeds the world behind a
  loading skeleton. The browser has search, category filter, sort
  (name/price/stock), and pagination.
- **Shopping cart** — add from the browser, adjust quantities, see line and
  running COP totals; lines the network cannot cover are flagged. Checkout
  submits through the *same* 202 → poll → stepper → toast pipeline as v1 (a
  manual SKU-entry fallback stays available behind a link).
- **Fulfillment plan** — when an order completes, its card explains which store
  fulfills each line (nearest store with stock; splits when necessary — "2
  artículos desde Mercado Norte, 1 desde SuperCosta Riomar"), the pickup route in
  nearest-neighbor order with per-leg kilometers, and total travel time at
  30 km/h. Completed orders decrement demo stock, which feeds the Low/Out badges
  and the widgets.
- **Dashboard widgets** — pending orders, fulfillment rate, today's orders,
  network units, per-store inventory mini-bars, low-stock list, top products —
  all derived live from demo state with count-up transitions.
- **Optional GA optimizer** — see [feature flag](#optional-pickup-optimizer) below.

Connected mode (`VITE_API_URL` set) keeps the classic contract dashboard —
manual order form, live board, recent orders — because the real API surface has
no inventory endpoints.

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

    U->>W: Build cart from inventory, checkout
    W->>W: plan fulfillment (nearest store with stock)
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
    Note over W: on completed: show fulfillment plan,<br/>decrement demo stock, update widgets
    Note over P,D: failures land in orders-dlq (maxReceiveCount 3)
```

**Client-side shape**

```
src/
  domain/      types transcribed from the contract + shared constants
  api/         typed client (client.ts) · route functions (orders.ts) · demo pipeline (demo.ts)
               optimizerClient.ts — optional GA pickup integration (flagged)
  demo/        the simulated retail world, all pure logic:
               catalog.ts (stores w/ map coords + grocery products)
               inventory.ts (seeded generator, status thresholds)
               cart.ts (totals, availability) · fulfillment.ts (assignment, route)
               stats.ts (widget selectors)
  lib/         money.ts (COP cents) · orderState.ts (state machine, poll cadence)
               rng.ts (mulberry32) · optimizerCompare.ts (before/after math)
  store/       ordersStore.ts (tracked orders, toasts) · demoStore.ts (world, cart, plans)
  hooks/       useOrderPolling.ts (per-order poll loop) · useCountUp.ts (widget animation)
  components/  inventory/ · cart/ · dashboard/ · ui/ (icons, tooltip, skeleton)
               OrderCard · StateStepper · FulfillmentPlanView · OptimizePickup · …
```

Every business rule (money, cart, state machine, inventory generation,
fulfillment, comparison math) lives as pure functions outside React — that is
what keeps the components small and the test suite fast.

---

## Fulfillment logic

Assignment is a two-pass greedy over stores sorted by euclidean distance from
the customer (origin):

1. **Pass 1** — the nearest store whose sellable stock (stock − reserved) covers
   the whole line takes it.
2. **Pass 2** — otherwise the line splits across the nearest stores with any
   stock; anything the network cannot cover is reported as a shortfall (the cart
   blocks checkout in that case).

Consumption is simulated against a local ledger so later lines see earlier
lines' reservations. The pickup route visits the chosen stores in
nearest-neighbor order and returns home; time = km ÷ 30 km/h — deliberately the
same model as the genetic optimizer's pickup problem, so the comparison is
apples-to-apples. Stock is decremented exactly once, when the pipeline reports
`completed`; failed orders release their plan untouched.

## Optional pickup optimizer

`VITE_OPTIMIZER_URL` (e.g. `http://localhost:8000`) feature-flags an
"Optimizar recogida" action on completed demo orders. It calls the
**genetic-visualizer-api** pickup problem (see `genetic/CONTRACT.md` v2):
`POST /api/runs { problem:"pickup", problemConfig:{ seed, stores, products,
needs } }` with a seed hashed from the orderId, then consumes the WebSocket
stream — the **first generation's** best solution is the un-optimized baseline
and the final `done` renderSpec is the optimized one. The card then shows
WITHOUT vs WITH: distance, travel time, store visits, item cost, and an overall
optimization % derived from fitness (cost = −fitness). Errors degrade to an
inline retry message; when the flag is unset the feature does not render.
Neither project depends on the other.

---

## Key decisions & trade-offs

| Decision | Choice | Why / trade-off |
| --- | --- | --- |
| **Live status transport** | **Polling** `GET /orders/:id` at 500ms, backing off to 5s as an order ages, stopping on terminal | The pipeline is short-lived (seconds) and each order self-terminates, so a bounded poll is simpler and cheaper than standing up WebSocket/AppSync infra. Backoff keeps a stuck order from hammering the API; terminal detection stops the loop entirely. Trade-off: not instant, one request per tick — fine at this scale. |
| **Submit UX** | **Optimistic** card on `202` | The contract's whole point is "accept fast". The card renders the instant the API returns `202 { orderId }`; polling reconciles it. Trade-off: the card shows `received` before the server confirms; the first poll corrects it. |
| **Demo world** | Seeded, deterministic generation (mulberry32) | Same seed ⇒ same stores, prices, stock — testable ("determinism" is pinned in the suite) and honest: "actualizar inventario" is a new seed, not hidden mutation. |
| **Fulfillment** | Greedy nearest-store-with-stock, client-side | Transparent and explainable in one sentence on the card — the right altitude for a demo. The GA integration exists precisely to show what a real optimizer buys over this greedy baseline. |
| **State model** | Pure state machine in `lib/orderState.ts` | `received→queued→processing→completed/failed` lives in one testable module that drives the stepper, the poll cadence, and terminal toasts. |
| **Money** | Integer **cents**, `es-CO` `COP` via `Intl` | Amounts are never floats; totals are computed the same way the server does: `sum(qty * unitPriceCents)`. |
| **State management** | **Zustand**, two small stores | `ordersStore` (session orders, toasts) and `demoStore` (world, cart, plans). Stock mutation has exactly one entry point (`commitFulfillment`), so the widgets can't drift. |
| **Demo mode** | Simulate the pipeline client-side when `VITE_API_URL` is unset | A portfolio site must be demoable with zero infra. `api/demo.ts` stands in for SQS + the process Lambda through the same `OrdersApi` interface — the polling UI runs identical code with or without AWS. |
| **Optimizer coupling** | Feature flag + WS stream consumption, no scenario endpoint | The comparison uses first-generation vs final solution of one run — zero extra endpoints, same scenario by construction, and the feature disappears entirely when the flag is unset. |

---

## What I'd change at scale

- **Push instead of poll.** Beyond a handful of concurrent orders, per-order
  polling is wasteful. I'd move status to **WebSocket API Gateway** or **AppSync
  subscriptions**, with the `process` Lambda publishing state changes. Polling
  stays as a graceful-degradation fallback.
- **Real inventory service.** The demo world would become `GET /inventory`
  endpoints backed by DynamoDB, with conditional-write reservations instead of a
  client-side ledger, and cache headers for the catalog.
- **Pagination + filtering** on `GET /orders` (cursor over the recent-orders
  GSI) and on the catalog.
- **Auth.** Cognito (or the org IdP) in front of API Gateway; scope orders to a
  tenant/store; JWT attached by a typed auth layer.
- **Resilience.** Idempotency keys on submit, request-level retry with jitter,
  DLQ/retry state surfaced in the UI.
- **Observability.** RUM + a correlation id echoed from the API so a card links
  straight to its CloudWatch trace.

---

## Local dev quickstart

Requires Node 20+.

```bash
npm install

# Demo mode (no backend needed) — full product experience, simulated pipeline:
npm run dev

# Connected mode — point at a deployed retail-serverless-api:
cp .env.example .env      # set VITE_API_URL=https://<api-id>.execute-api.<region>.amazonaws.com/v1

# Optional: enable the GA pickup optimizer against a local genetic-visualizer-api:
#   VITE_OPTIMIZER_URL=http://localhost:8000

npm test            # Vitest: money, state machine, inventory determinism, cart, fulfillment, optimizer math
npm run build       # type-check (tsc --noEmit) + vite build → dist/
npm run lint        # ESLint (typed, flat config)
```

Container parity with the other repos:

```bash
docker build -t retail-serverless-web \
  --build-arg VITE_API_URL="https://<api-id>.execute-api.<region>.amazonaws.com/v1" .
docker run --rm -p 8080:80 retail-serverless-web   # → http://localhost:8080
```

---

_Author: Jonathan Ilias — Senior Full Stack & Cloud Engineer · jdavid.ilias@gmail.com_
