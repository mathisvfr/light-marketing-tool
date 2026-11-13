import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Wraps react-router's navigate() with the View Transitions API for smooth
 * crossfade animations between pages. Falls back to instant navigation in
 * browsers that don't support it (~15% as of late 2026).
 *
 * Usage:
 *   const navigateWithTransition = useViewTransition();
 *   navigateWithTransition('/content-wachtrij');
 */
export function useViewTransition() {
  const navigate = useNavigate();

  return useCallback(
    (to, options) => {
      if (document.startViewTransition) {
        document.startViewTransition(() => {
          navigate(to, options);
        });
      } else {
        navigate(to, options);
      }
    },
    [navigate],
  );
}
