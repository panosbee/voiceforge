// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — API Client
// Typed HTTP client for communication with the Hono backend
// ═══════════════════════════════════════════════════════════════════

import { API_URL } from './env';
import type { ApiResponse } from '@voiceforge/shared';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  /** Override base URL */
  baseUrl?: string;
  /** Additional headers */
  headers?: Record<string, string>;
  /** Query parameters */
  params?: Record<string, string | number | boolean | undefined>;
  /** Request body (auto-serialized to JSON) */
  body?: unknown;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

class ApiClient {
  private baseUrl: string;
  private getToken: (() => Promise<string | null>) | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /** Set the auth token provider (e.g. Supabase session) */
  setTokenProvider(provider: () => Promise<string | null>) {
    this.getToken = provider;
  }

  /** Build the full URL with query params */
  private buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }

  /** Core fetch wrapper */
  private async request<T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(path, options.params);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Attach auth token
    if (this.getToken) {
      const token = await this.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const response = await fetch(url, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ error: { message: response.statusText } }));
      const message = (errorBody as ApiResponse<never>).error?.message ?? `Request failed: ${response.status}`;
      throw new ApiError(response.status, message, errorBody);
    }

    return response.json() as Promise<T>;
  }

  // ── HTTP Method Shortcuts ────────────────────────────────────────

  get<T>(path: string, options?: RequestOptions) {
    return this.request<T>('GET', path, options);
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>('POST', path, { ...options, body });
  }

  patch<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>('PATCH', path, { ...options, body });
  }

  put<T>(path: string, body?: unknown, options?: RequestOptions) {
    return this.request<T>('PUT', path, { ...options, body });
  }

  delete<T>(path: string, options?: RequestOptions) {
    return this.request<T>('DELETE', path, options);
  }

  /**
   * Upload a file via multipart/form-data.
   * Does NOT set Content-Type (browser sets it with boundary).
   */
  async upload<T>(path: string, formData: FormData, options: Omit<RequestOptions, 'body'> = {}): Promise<T> {
    const url = this.buildUrl(path, options.params);

    const headers: Record<string, string> = {
      ...options.headers,
    };

    // Attach auth token
    if (this.getToken) {
      const token = await this.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
      signal: options.signal,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ error: { message: response.statusText } }));
      const message = (errorBody as ApiResponse<never>).error?.message ?? `Upload failed: ${response.status}`;
      throw new ApiError(response.status, message, errorBody);
    }

    return response.json() as Promise<T>;
  }
}

/** Typed API error with status code */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Singleton API client instance */
export const api = new ApiClient(API_URL);
