// Shared Toast-systeem — context-provider + useToast()-hook + host.
//
// Design:
// - Errors zijn PERSISTENT tot dismiss (autoplan design-review finding #6:
//   4s auto-dismiss = user mist error bij afwenden).
// - Success/attention/info auto-dismiss na 4s / 6s / 4s respectievelijk.
// - Max 3 stapelen (nieuwer duwt oudere weg) per design-review finding.
// - Mobiel: bottom-center voor duim-bereikbaarheid.
// - toast.promise() voor async mutations (Buffer-post pattern).
//
// Usage:
//   const toast = useToast();
//   toast.success('Concept opgeslagen');
//   toast.error('Publiceren mislukt: ...');
//   toast.promise(mutation.mutateAsync(id), {
//     loading: 'Verzenden...',
//     success: 'Verzonden',
//     error: (err) => `Fout: ${err.message}`,
//   });
//
// De <ToastProvider> moet in App.jsx om <RouterProvider> heen; consumers
// (elke pagina/component) roepen useToast() aan.
//
// Autoplan-review UC/finding: ToastProvider MOET binnen ErrorBoundary staan
// zodat een throw in de reducer niet de hele app sloopt. App.jsx wrap.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const ToastContext = createContext(null);

let nextId = 1;

const AUTO_DISMISS_MS = {
  success: 4000,
  info: 4000,
  attention: 6000,
  error: null, // persistent
  loading: null, // persistent tot promise settled
};

const ICONS = {
  success: '✓',
  error: '✕',
  attention: '⚠',
  info: 'ⓘ',
  loading: '⟳',
};

const MAX_STACK = 3;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const removeToast = useCallback((id) => {
    const timerId = timersRef.current.get(id);
    if (timerId) {
      clearTimeout(timerId);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type, message, options = {}) => {
      const id = nextId++;
      const toast = {
        id,
        type,
        message,
        actionLabel: options.actionLabel || null,
        onAction: options.onAction || null,
      };
      setToasts((prev) => {
        const next = [...prev, toast];
        // Stack-limiet: oudste eruit als we boven MAX_STACK komen.
        if (next.length > MAX_STACK) {
          const removed = next.slice(0, next.length - MAX_STACK);
          for (const r of removed) {
            const tid = timersRef.current.get(r.id);
            if (tid) {
              clearTimeout(tid);
              timersRef.current.delete(r.id);
            }
          }
          return next.slice(-MAX_STACK);
        }
        return next;
      });

      const dismissAfter = AUTO_DISMISS_MS[type];
      if (dismissAfter !== null && dismissAfter !== undefined) {
        const timerId = setTimeout(() => removeToast(id), dismissAfter);
        timersRef.current.set(id, timerId);
      }

      return id;
    },
    [removeToast]
  );

  // Cleanup alle timers op unmount.
  useEffect(() => {
    return () => {
      for (const t of timersRef.current.values()) clearTimeout(t);
      timersRef.current.clear();
    };
  }, []);

  const value = {
    success: (msg, opts) => addToast('success', msg, opts),
    error: (msg, opts) => addToast('error', msg, opts),
    attention: (msg, opts) => addToast('attention', msg, opts),
    info: (msg, opts) => addToast('info', msg, opts),
    // promise(): laat een async mutation zien met loading → success/error transitie.
    promise: async (promise, { loading, success, error }) => {
      const id = addToast('loading', loading || 'Bezig...');
      try {
        const result = await promise;
        removeToast(id);
        addToast('success', typeof success === 'function' ? success(result) : success);
        return result;
      } catch (err) {
        removeToast(id);
        const msg = typeof error === 'function' ? error(err) : error || (err?.message || 'Er ging iets mis.');
        addToast('error', msg);
        throw err;
      }
    },
    dismiss: removeToast,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastHost toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast() moet binnen <ToastProvider> gebruikt worden.');
  }
  return ctx;
}

function ToastHost({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-host" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast-${toast.type}`}
          role={toast.type === 'error' ? 'alert' : 'status'}
        >
          <span className="toast-icon" aria-hidden="true">
            {ICONS[toast.type] || ''}
          </span>
          <span className="toast-message">{toast.message}</span>
          {toast.actionLabel && toast.onAction ? (
            <button
              type="button"
              className="toast-action"
              onClick={() => {
                toast.onAction();
                onDismiss(toast.id);
              }}
            >
              {toast.actionLabel}
            </button>
          ) : null}
          <button
            type="button"
            className="toast-dismiss"
            aria-label="Sluiten"
            onClick={() => onDismiss(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
