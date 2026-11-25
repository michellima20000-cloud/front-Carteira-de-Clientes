import { API_BASE_URL } from '../config/env';
import { tokenStore } from './tokenStore';

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: HeadersInit;
  signal?: AbortSignal;
  auth?: boolean;
  retryOnUnauthorized?: boolean;
  /** Quando false, mantém o envelope completo da API (data + meta). */
  unwrap?: boolean;
}

type UnauthorizedHandler = () => Promise<boolean>;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const candidate = payload as {
    message?: unknown;
    error?: { message?: unknown } | string;
  };

  if (typeof candidate.message === 'string' && candidate.message.trim()) {
    return candidate.message;
  }

  if (typeof candidate.error === 'string' && candidate.error.trim()) {
    return candidate.error;
  }

  if (
    candidate.error &&
    typeof candidate.error === 'object' &&
    typeof candidate.error.message === 'string' &&
    candidate.error.message.trim()
  ) {
    return candidate.error.message;
  }

  return fallback;
}

async function parsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';

  if (response.status === 204) {
    return null;
  }

  if (contentType.includes('application/json')) {
    try {
      return (await response.json()) as unknown;
    } catch {
      return null;
    }
  }

  try {
    const text = await response.text();
    return text || null;
  } catch {
    return null;
  }
}

async function executeRequest<T>(
  path: string,
  options: ApiRequestOptions,
  allowRefresh: boolean,
): Promise<T> {
  const headers = new Headers(options.headers);
  const usesAuthentication = options.auth !== false;
  const currentAccessToken = tokenStore.getAccessToken();

  if (usesAuthentication && currentAccessToken) {
    headers.set('Authorization', `Bearer ${currentAccessToken}`);
  }

  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: 'include',
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    throw new ApiError(
      'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
      0,
      'NETWORK_ERROR',
      error,
    );
  }

  if (
    response.status === 401 &&
    allowRefresh &&
    usesAuthentication &&
    options.retryOnUnauthorized !== false &&
    unauthorizedHandler
  ) {
    const refreshed = await unauthorizedHandler();
    if (refreshed) {
      return executeRequest<T>(path, options, false);
    }
  }

  const payload = await parsePayload(response);

  if (!response.ok) {
    const fallback =
      response.status === 401
        ? 'Sua sessão expirou. Entre novamente para continuar.'
        : 'Não foi possível concluir a solicitação. Tente novamente.';
    const message = extractErrorMessage(payload, fallback);
    const details = payload as { code?: unknown } | null;
    const code = typeof details?.code === 'string' ? details.code : undefined;

    throw new ApiError(message, response.status, code, payload);
  }

  if (options.unwrap !== false && payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data;
  }

  return payload as T;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return executeRequest<T>(path, options, true);
}
