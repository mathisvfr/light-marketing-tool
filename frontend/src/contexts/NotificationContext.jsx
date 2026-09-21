import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';

export function NotificationProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const eventSourceRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const retryDelayRef = useRef(1000);

  useEffect(() => {
    if (!isAuthenticated) {
      // Clean up if user logs out
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      return;
    }

    function connect() {
      // Close existing connection if any
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const es = new EventSource('/api/notifications/stream', { withCredentials: true });
      eventSourceRef.current = es;

      es.onopen = () => {
        // Reset backoff on successful connection
        retryDelayRef.current = 1000;
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'notification') {
            // Invalidate notification queries to trigger re-fetch
            queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
          }
        } catch {
          // Ignore parse errors
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;

        // Exponential backoff, max 30s
        const delay = retryDelayRef.current;
        retryDelayRef.current = Math.min(delay * 2, 30000);

        retryTimeoutRef.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [isAuthenticated, queryClient]);

  return children;
}
