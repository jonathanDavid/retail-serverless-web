import type {
  CreateOrderRequest,
  CreateOrderResponse,
  HealthResponse,
  Order,
} from '@/domain/types';
import { IS_DEMO_MODE, request } from './client';
import { demoApi } from './demo';

/**
 * Typed client for the REST API defined in the contract (base path `/v1`):
 *
 *   POST /orders      { customer, items, store } → 202 { orderId, status }
 *   GET  /orders/:id  → Order
 *   GET  /orders      → Order[] (recent, newest first)
 *   GET  /health      → { ok: true }
 *
 * When DEMO mode is active (no VITE_API_URL) every call is transparently routed
 * to an in-memory simulator so the UI behaves identically without a backend.
 */
export interface OrdersApi {
  createOrder(req: CreateOrderRequest): Promise<CreateOrderResponse>;
  getOrder(orderId: string, signal?: AbortSignal): Promise<Order>;
  listOrders(signal?: AbortSignal): Promise<Order[]>;
  health(): Promise<HealthResponse>;
}

const httpApi: OrdersApi = {
  createOrder(req) {
    return request<CreateOrderResponse>('/orders', {
      method: 'POST',
      body: req,
      expectStatus: 202,
    });
  },
  getOrder(orderId, signal) {
    return request<Order>(`/orders/${encodeURIComponent(orderId)}`, { signal });
  },
  listOrders(signal) {
    return request<Order[]>('/orders', { signal });
  },
  health() {
    return request<HealthResponse>('/health');
  },
};

/** The active API implementation — real HTTP or the demo simulator. */
export const ordersApi: OrdersApi = IS_DEMO_MODE ? demoApi : httpApi;
