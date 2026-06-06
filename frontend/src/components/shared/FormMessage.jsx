import { cn } from '@/lib/utils';

/**
 * Inline form feedback banner.
 * variant: 'error' | 'success'
 */
export default function FormMessage({ variant = 'error', children, className }) {
  if (!children) {
    return null;
  }

  return (
    <p
      className={cn(
        'rounded-md px-3 py-2 text-sm',
        variant === 'error'
          ? 'bg-destructive/10 text-destructive'
          : 'bg-success/10 text-success',
        className,
      )}
    >
      {children}
    </p>
  );
}
