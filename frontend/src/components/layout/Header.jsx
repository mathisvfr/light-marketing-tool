import { LogOut } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ROLE_LABELS } from '@/lib/constants';

function initials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export default function Header({ pageTitle, userName, role, onLogout }) {
  return (
    <header className="flex flex-col gap-3 border-b border-border bg-card px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-display font-bold uppercase tracking-[0.14em] text-primary">
          Overzicht
        </p>
        <h1 className="mt-0.5 text-2xl">{pageTitle}</h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-3">
          <Avatar className="bg-grey-100">
            <AvatarFallback className="text-sm">{initials(userName)}</AvatarFallback>
          </Avatar>
          <div className="leading-tight">
            <span className="block font-display font-bold">{userName}</span>
            <Badge variant="secondary" className="mt-0.5">
              {ROLE_LABELS[role] || role || 'Onbekend'}
            </Badge>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={onLogout}>
          <LogOut className="size-4" />
          Uitloggen
        </Button>
      </div>
    </header>
  );
}
