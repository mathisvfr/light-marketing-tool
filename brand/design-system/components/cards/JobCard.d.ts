import * as React from 'react';

/**
 * Vacancy card (vacaturekaart) — the brand's signature listing unit.
 *
 * @startingPoint section="Cards" subtitle="Vacancy listing: photo, category, meta, teaser" viewport="700x420"
 */
export interface JobCardProps {
  /** Job title, e.g. "Meewerkend chauffeur". */
  title: string;
  /** Photo URL (production line, truck, etc.). */
  image: string;
  imageAlt?: string;
  /** Domain category — drives the icon. */
  category?: 'Productie' | 'Logistiek' | 'Schoonmaak';
  location?: string;
  hours?: string;
  /** Short Dutch teaser sentence. */
  teaser?: string;
  /** Read-time label, e.g. "1,2 min". */
  readTime?: string;
  onClick?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}

export function JobCard(props: JobCardProps): JSX.Element;
