import type { ApiErrorBody } from '@/domain/types';

/**
 * Thin typed fetch wrapper. Centralises base-URL handling, JSON parsing, and
 * the contract's error envelope so route functions stay declarative.
 */

/** Base URL of the API including `/v1`. Empty string means DEMO mode. */
export const API_BASE_URL: string = (
  import.meta.env.VITE_API_URL ?? ''
).replace(/\/+$/, '');

/** True when no backend is configured and the app runs the demo simulator. */
export const IS_DEMO_MODE = API_BASE_URL === '';

/** Structured error mirroring the contract's `{ error, message }` envelope. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, body: Partial<ApiErrorBody>) {
    super(body.message ?? body.error ?? `Request failed (${status})`);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.error ?? 'unknown_error';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  signal?: AbortSignal;
  /** Expected success status. Defaults to any 2xx. */
  expectStatus?: number;
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (text === '') return undefined as T;
  return JSON.parse(text) as T;
}

/**
 * Perform a typed request against the API. Throws {@link ApiError} on any
 * non-2xx (or non-`expectStatus`) response, decoding the error envelope.
 */
export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, signal, expectStatus } = options;

  const init: RequestInit = {
    method,
    headers: { Accept: 'application/json' },
  };
  if (signal) init.signal = signal;
  if (body !== undefined) {
    init.headers = { ...init.headers, 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, init);

  const ok =
    expectStatus !== undefined ? res.status === expectStatus : res.ok;
  if (!ok) {
    let errorBody: Partial<ApiErrorBody> = {};
    try {
      errorBody = await parseJson<Partial<ApiErrorBody>>(res);
    } catch {
      // Non-JSON error body — fall back to status text.
      errorBody = { error: 'http_error', message: res.statusText };
    }
    throw new ApiError(res.status, errorBody);
  }

  return parseJson<T>(res);
}
