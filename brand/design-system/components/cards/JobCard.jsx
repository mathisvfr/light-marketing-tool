import React from 'react';
import { Card } from './Card.jsx';

/**
 * Light Personeelsdiensten — JobCard (vacaturekaart)
 * Domain card for a single vacancy: photo, title, location/hours meta,
 * short teaser, read-time, and a red "Lees meer" affordance.
 */
export function JobCard({
  title,
  image,
  imageAlt = '',
  category = 'Productie',      // Productie | Logistiek | Schoonmaak
  location = 'Rotterdam',
  hours = 'Fulltime',
  teaser,
  readTime,
  onClick,
  style = {},
}) {
  const catIcon = {
    Productie: 'factory',
    Logistiek: 'truck',
    Schoonmaak: 'spray-can',
  }[category] || 'briefcase';

  const Meta = ({ icon, children }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}>
      <i data-lucide={icon} style={{ width: 14, height: 14 }} />
      {children}
    </span>
  );

  return (
    <Card image={image} imageAlt={imageAlt} interactive padding={20} onClick={onClick} style={style}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{
          alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6,
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 11, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'var(--color-primary)',
          background: 'var(--color-primary-soft)', padding: '5px 10px', borderRadius: 'var(--radius-pill)',
        }}>
          <i data-lucide={catIcon} style={{ width: 13, height: 13 }} />{category}
        </span>

        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, lineHeight: 1.2, color: 'var(--color-text)', margin: 0 }}>
          {title}
        </h3>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Meta icon="map-pin">{location}</Meta>
          <Meta icon="clock">{hours}</Meta>
        </div>

        {teaser && (
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14.5, lineHeight: 1.55, color: 'var(--color-text-muted)', margin: 0 }}>
            {teaser}
          </p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, color: 'var(--color-primary)' }}>
            Lees meer <i data-lucide="arrow-right" style={{ width: 16, height: 16 }} />
          </span>
          {readTime && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--color-text-subtle)' }}>{readTime}</span>
          )}
        </div>
      </div>
    </Card>
  );
}
