import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Content type badge: vacature (red) vs marketing-post (grey).
 */
export default function TypeBadge({ type, className }) {
  const isMarketing = type === 'marketing-post' || type === 'marketing';
  return (
    <Badge
      variant={isMarketing ? 'secondary' : 'default'}
      className={cn(className)}
    >
      {isMarketing ? 'Marketing' : 'Vacature'}
    </Badge>
  );
}
