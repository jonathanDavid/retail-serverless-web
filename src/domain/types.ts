/**
 * Domain types transcribed verbatim from the shared architecture contract
 * (serverless/CONTRACT.md, "Domain model"). These MUST stay in lockstep with
 * retail-serverless-api; the API is the source of truth, the web layer mirrors it.
 */

/** The five order states. `received → queued → processing` are transient; */
/** `completed` and `failed` are terminal. */
export type OrderStatus =
  | 'received'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed';

/** Ordered list of the states as they appear in the pipeline stepper. */
export const ORDER_STATUS_FLOW = [
  'received',
  'queued',
  'processing',
  'completed',
] as const satisfies readonly OrderStatus[];

/** Only currency the backend deals in. */
export type Currency = 'COP';

export interface Customer {
  name: string;
  email: string;
}

export interface OrderItem {
  sku: string;
  name: string;
  qty: number;
  /** Unit price stored as an integer number of cents — never a float. */
  unitPriceCents: number;
}

/** Canonical Order as returned by `GET /v1/orders/:id` and `GET /v1/orders`. */
export interface Order {
  orderId: string;
  status: OrderStatus;
  customer: Customer;
  items: OrderItem[];
  currency: Currency;
  /** Server-computed sum(qty * unitPriceCents). */
  totalCents: number;
  store: string;
  createdAt: string;
  updatedAt: string;
  failureReason: string | null;
}

/** Request body for `POST /v1/orders`. */
export interface CreateOrderRequest {
  customer: Customer;
  items: OrderItem[];
  store: string;
}

/** `202 Accepted` response body for `POST /v1/orders`. */
export interface CreateOrderResponse {
  orderId: string;
  status: Extract<OrderStatus, 'received'>;
}

/** `GET /v1/health` response. */
export interface HealthResponse {
  ok: true;
}

/** Canonical error envelope: `{ error, message }` with a 4xx/5xx status. */
export interface ApiErrorBody {
  error: string;
  message: string;
}
