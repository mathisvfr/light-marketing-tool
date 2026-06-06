import { NavLink } from 'react-router-dom';
import * as Icons from 'lucide-react';

import Logo from '@/components/shared/Logo';
import { cn } from '@/lib/utils';

function NavIcon({ name, className }) {
  const Icon = Icons[name] || Icons.Circle;
  return <Icon className={className} strokeWidth={1.75} aria-hidden="true" />;
}

export default function Sidebar({ items }) {
  return (
    <aside className="flex h-full flex-col gap-6 bg-sidebar px-4 py-5 text-sidebar-foreground">
      <div className="flex items-center gap-3 px-2">
        <Logo variant="white" className="h-10" />
      </div>

      <nav className="grid gap-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground font-display font-bold'
                  : 'text-sidebar-foreground/85',
              )
            }
          >
            <NavIcon name={item.icon} className="size-4.5 shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
