export const APP_NAME = 'Light Marketing Tool';
export const COMPANY_NAME = 'Light Personeelsdiensten';

/**
 * Primary navigation. `ownerOnly` items are hidden for non-owners.
 * `icon` is a lucide-react icon name resolved in the Sidebar.
 */
export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: 'LayoutDashboard' },
  { to: '/vacature-plaatsen', label: 'Vacature plaatsen', icon: 'Briefcase' },
  { to: '/marketing-post', label: 'Marketing post', icon: 'Megaphone' },
  { to: '/content-wachtrij', label: 'Content wachtrij', icon: 'ListChecks' },
  { to: '/gepubliceerd', label: 'Gepubliceerd', icon: 'Send' },
  { to: '/merk-instellingen', label: 'Merk instellingen', icon: 'Settings', ownerOnly: true },
  { to: '/gebruikers', label: 'Gebruikers', icon: 'Users', ownerOnly: true },
];

export const ROUTE_TITLES = NAV_ITEMS.reduce((acc, item) => {
  acc[item.to] = item.label;
  return acc;
}, {});

/** Dutch labels for roles, used in badges. */
export const ROLE_LABELS = {
  owner: 'Eigenaar',
  recruiter: 'Recruiter',
  viewer: 'Kijker',
};
