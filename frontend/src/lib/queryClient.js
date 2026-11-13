import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      // Default staleTime — overridden per-query via queryKeys factories.
      // 30s is a sensible baseline: data doesn't go stale instantly, but
      // we don't serve minutes-old content either.
      staleTime: 30_000,
      // Keep unused query data in cache for 5 minutes before GC.
      gcTime: 5 * 60_000,
    },
    mutations: {
      // Retry mutations once on network errors only (not 4xx).
      retry: (failureCount, error) => {
        if (failureCount >= 1) return false;
        // Only retry on network/5xx errors, not validation errors.
        return error?.status >= 500 || !error?.status;
      },
    },
  },
});
