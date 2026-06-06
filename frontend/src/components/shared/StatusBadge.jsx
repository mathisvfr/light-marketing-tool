import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Draft status badge with Dutch labels and brand-aligned colours.
 * Statuses: draft | pending_approval | approved | published | expired
 */
const STATUS_CONFIG = {
  draft: { label: 'Concept', className: 'bg-grey-100 text-grey-700' },
  pending_approval: {
    label: 'Wacht op goedkeuring',
    className: 'bg-[#fbeedd] text-[#8a5a16]',
  },
  approved: { label: 'Goedgekeurd', className: 'bg-[#e3eef6] text-[#235a7e]' },
  published: { label: 'Gepubliceerd', className: 'bg-[#e3f1e8] text-[#1f6b3c]' },
  expired: { label: 'Verlopen', className: 'bg-grey-100 text-grey-500' },
};

export default function StatusBadge({ status, className }) {
  const config = STATUS_CONFIG[status] || {
    label: status || 'Onbekend',
    className: 'bg-grey-100 text-grey-700',
  };

  return (
    <Badge className={cn('border-transparent', config.className, className)}>
      {config.label}
    </Badge>
  );
}
