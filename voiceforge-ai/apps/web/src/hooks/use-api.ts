// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Data Fetching Hooks
// SWR-like hooks built on top of the typed API client.
// No extra dependency — just React + our ApiClient.
// ═══════════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api, ApiError } from '@/lib/api-client';
import type { ApiResponse } from '@voiceforge/shared';

// ═══════════════════════════════════════════════════════════════════
// Generic useFetch hook — GET requests with auto-refresh
// ═══════════════════════════════════════════════════════════════════

interface UseFetchOptions {
  /** Fetch on mount (default: true) */
  immediate?: boolean;
  /** Query params appended to the URL */
  params?: Record<string, string | number | boolean | undefined>;
  /** Auto-refetch interval in ms (0 = disabled) */
  refreshInterval?: number;
}

interface UseFetchReturn<T> {
  data: T | null;
  error: ApiError | null;
  isLoading: boolean;
  /** Manually refresh */
  refresh: () => Promise<void>;
  /** Manually set data (optimistic update) */
  setData: (data: T | null) => void;
}

export function useFetch<T>(path: string | null, options: UseFetchOptions = {}): UseFetchReturn<T> {
  const { immediate = true, params, refreshInterval = 0 } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(immediate && path !== null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    if (!path) return;
    setIsLoading(true);
    setError(null);

    try {
      const result = await api.get<ApiResponse<T>>(path, { params });
      if (mountedRef.current) {
        if (result.success && result.data !== undefined) {
          setData(result.data);
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof ApiError ? err : new ApiError(500, String(err)));
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, JSON.stringify(params)]);

  // Fetch on mount / when path or params change
  useEffect(() => {
    mountedRef.current = true;
    if (immediate && path) {
      fetchData();
    }
    return () => {
      mountedRef.current = false;
    };
  }, [fetchData, immediate, path]);

  // Auto-refresh interval
  useEffect(() => {
    if (refreshInterval <= 0 || !path) return;
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval, path]);

  return { data, error, isLoading, refresh: fetchData, setData };
}

// ═══════════════════════════════════════════════════════════════════
// useMutation — for POST / PATCH / PUT / DELETE operations
// ═══════════════════════════════════════════════════════════════════

interface UseMutationReturn<TInput, TOutput> {
  mutate: (input: TInput) => Promise<TOutput | null>;
  data: TOutput | null;
  error: ApiError | null;
  isLoading: boolean;
  reset: () => void;
}

export function useMutation<TInput, TOutput>(
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
): UseMutationReturn<TInput, TOutput> {
  const [data, setData] = useState<TOutput | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const mutate = useCallback(
    async (input: TInput): Promise<TOutput | null> => {
      setIsLoading(true);
      setError(null);
      try {
        let result: ApiResponse<TOutput>;
        switch (method) {
          case 'POST':
            result = await api.post<ApiResponse<TOutput>>(path, input);
            break;
          case 'PATCH':
            result = await api.patch<ApiResponse<TOutput>>(path, input);
            break;
          case 'PUT':
            result = await api.put<ApiResponse<TOutput>>(path, input);
            break;
          case 'DELETE':
            result = await api.delete<ApiResponse<TOutput>>(path);
            break;
        }
        if (result.success && result.data !== undefined) {
          setData(result.data);
          return result.data;
        }
        return null;
      } catch (err) {
        const apiError = err instanceof ApiError ? err : new ApiError(500, String(err));
        setError(apiError);
        throw apiError;
      } finally {
        setIsLoading(false);
      }
    },
    [method, path],
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return { mutate, data, error, isLoading, reset };
}

// ═══════════════════════════════════════════════════════════════════
// Domain-Specific Hooks
// ═══════════════════════════════════════════════════════════════════

import type {
  CustomerProfile,
  AgentSummary,
  AgentDetail,
  CallSummary,
  CallDetail,
} from '@voiceforge/shared';

/** Fetch the current customer profile */
export function useCustomerProfile() {
  return useFetch<CustomerProfile>('/api/customers/me');
}

/** Fetch all agents for the current customer */
export function useAgents() {
  return useFetch<AgentSummary[]>('/api/agents');
}

/** Fetch a single agent by ID */
export function useAgent(agentId: string | null) {
  return useFetch<AgentDetail>(agentId ? `/api/agents/${agentId}` : null);
}

/** Fetch paginated calls */
export function useCalls(params?: {
  page?: number;
  pageSize?: number;
  agentId?: string;
  status?: string;
}) {
  return useFetch<{ calls: CallSummary[]; total: number; page: number; pageSize: number }>(
    '/api/calls',
    { params: params as Record<string, string | number | boolean | undefined> },
  );
}

/** Fetch a single call by ID */
export function useCall(callId: string | null) {
  return useFetch<CallDetail>(callId ? `/api/calls/${callId}` : null);
}

/** Fetch dashboard analytics summary */
export function useAnalytics() {
  return useFetch<{
    totalCalls: number;
    totalMinutes: number;
    missedCalls: number;
    appointmentsBooked: number;
    averageSentiment: number;
    averageDuration: number;
  }>('/api/calls/analytics/summary', { refreshInterval: 60_000 });
}

/** Search available phone numbers */
export function useAvailableNumbers(
  locality?: string,
  enabled: boolean = false,
) {
  return useFetch<Array<{
    phoneNumber: string;
    monthlyCost: string;
    upfrontCost: string;
    currency: string;
    features: string[];
    region: string;
  }>>(enabled ? '/api/numbers/available' : null, {
    params: locality ? { locality } : undefined,
  });
}
