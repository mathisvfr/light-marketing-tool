import * as React from 'react';

/**
 * Small status pill (e.g. "Vacature open", "SNA-gecertificeerd").
 *
 * @startingPoint section="Feedback" subtitle="Status pill in brand tones" viewport="700x120"
 */
export interface BadgeProps {
  /** Colour tone. Default "red". */
  tone?: 'red' | 'grey' | 'green' | 'amber' | 'blue' | 'dark';
  /** Fill the badge with the tone colour (white text). Default false (soft tint). */
  solid?: boolean;
  /** Optional Lucide icon name. */
  icon?: string | null;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function Badge(props: BadgeProps): JSX.Element;
