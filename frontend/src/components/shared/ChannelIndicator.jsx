import { cn } from '@/lib/utils';

/**
 * Per-channel status dot + label.
 * status: success | failed | pending | unknown
 */
const DOT = {
  success: 'bg-success',
  failed: 'bg-destructive',
  pending: 'bg-attention',
  unknown: 'bg-grey-300',
};

export default function ChannelIndicator({ channel, status = 'unknown', className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-sm text-muted-foreground',
        className,
      )}
    >
      <span
        className={cn('size-2.5 shrink-0 rounded-full', DOT[status] || DOT.unknown)}
        aria-hidden="true"
      />
      {channel}
    </span>
  );
}
