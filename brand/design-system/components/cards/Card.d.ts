import * as React from 'react';

/**
 * Content surface: white card with border, soft shadow, optional image header.
 *
 * @startingPoint section="Cards" subtitle="White surface with optional image header" viewport="700x320"
 */
export interface CardProps {
  /** Optional image URL shown as a full-width header. */
  image?: string | null;
  imageAlt?: string;
  /** Header image height in px. Default 180. */
  imageHeight?: number;
  /** Enable hover lift + image zoom + red border. Default false. */
  interactive?: boolean;
  /** Body padding in px. Default 24. */
  padding?: number;
  onClick?: (e: React.MouseEvent) => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function Card(props: CardProps): JSX.Element;
