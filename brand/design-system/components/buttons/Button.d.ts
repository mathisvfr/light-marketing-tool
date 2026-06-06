import * as React from 'react';

/**
 * Light Personeelsdiensten primary action button.
 *
 * @startingPoint section="Buttons" subtitle="Brand-red CTA with notch & icon variants" viewport="700x160"
 */
export interface ButtonProps {
  /** Visual style. Default "primary". */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  /** Size. Default "md". */
  size?: 'sm' | 'md' | 'lg';
  /** Apply the logo's cut-corner (notched) silhouette. Use sparingly on hero CTAs. */
  notch?: boolean;
  /** Lucide icon name on the left (e.g. "arrow-right"). Requires lucide.createIcons(). */
  icon?: string | null;
  /** Lucide icon name on the right. */
  iconRight?: string | null;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (e: React.MouseEvent) => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function Button(props: ButtonProps): JSX.Element;
