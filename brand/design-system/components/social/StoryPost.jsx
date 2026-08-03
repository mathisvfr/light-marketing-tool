/* Instagram/Facebook Story — recreated from ui_kits/social/templates.js
   storyVacancy: full-bleed photo, dark wash, logo + category chip, and a
   brand-red panel with the signature angled top edge. Satori has no
   clip-path support, so the angle is drawn as a filled SVG polygon behind
   the panel content instead of a CSS clip-path.
   Fixed vertical canvas: instagram/facebook story 1080x1920.
*/
import { TOKENS } from './tokens.js';
import { LOGO_WHITE } from './logos.js';
import { Icon } from './icons.jsx';

export function StoryPost({ width = 1080, height = 1920, photoSrc, category = 'Logistiek', categoryIcon = 'truck', title = 'Meewerkend chauffeur', location = 'Rotterdam', hours = 'Fulltime', ctaLabel = 'Solliciteer — link in bio', logoSrc = LOGO_WHITE }) {
  const pad = Math.round(width * 0.0667);
  const logoSize = Math.round(width * 0.1);
  const pillFont = Math.round(width * 0.026);
  const eyebrowSize = Math.round(width * 0.0296);
  const titleSize = Math.round(width * 0.096);
  const metaSize = Math.round(width * 0.0333);
  const ctaFont = Math.round(width * 0.0333);
  const diagonalH = Math.round(width * 0.12);
  const panelH = Math.round(height * 0.4);

  return (
    <div style={{ width, height, position: 'relative', display: 'flex', background: TOKENS.grey900 }}>
      <img src={photoSrc} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(31,33,35,0.18)' }} />
      <div style={{ position: 'absolute', top: pad, left: pad, display: 'flex' }}>
        <img src={logoSrc} style={{ height: logoSize }} />
      </div>
      <div style={{ position: 'absolute', top: pad, right: pad, display: 'flex', alignItems: 'center', gap: Math.round(pillFont * 0.55), background: TOKENS.red, color: TOKENS.white, borderRadius: 999, padding: `${Math.round(pillFont * 0.65)}px ${Math.round(pillFont * 1.15)}px`, fontFamily: TOKENS.fontDisplay, fontWeight: 700, fontSize: pillFont, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        <Icon name={categoryIcon} size={Math.round(pillFont * 1.15)} color={TOKENS.white} strokeWidth={2.4} />{category}
      </div>
      <div style={{ position: 'absolute', left: 0, bottom: 0, width, height: panelH }}>
        <svg width={width} height={panelH} style={{ position: 'absolute', top: 0, left: 0 }}>
          <polygon points={`0,${diagonalH} ${width},0 ${width},${panelH} 0,${panelH}`} fill={TOKENS.red} />
        </svg>
        <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: `0 ${pad}px ${Math.round(panelH * 0.12)}px`, boxSizing: 'border-box', gap: Math.round(titleSize * 0.24) }}>
          <div style={{ display: 'flex', fontFamily: TOKENS.fontDisplay, fontWeight: 700, fontSize: eyebrowSize, color: 'rgba(255,255,255,0.85)', letterSpacing: Math.round(eyebrowSize * 0.16), textTransform: 'uppercase' }}>Wij zoeken</div>
          <div style={{ display: 'flex', fontFamily: TOKENS.fontDisplay, fontWeight: 800, fontSize: titleSize, color: TOKENS.white, lineHeight: 1.05, letterSpacing: -0.5 }}>{title}</div>
          <div style={{ display: 'flex', gap: Math.round(metaSize * 0.9), fontFamily: TOKENS.fontBody, fontWeight: 600, fontSize: metaSize, color: TOKENS.white }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(metaSize * 0.35) }}><Icon name="map-pin" size={Math.round(metaSize * 1.15)} color={TOKENS.white} strokeWidth={2.2} />{location}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(metaSize * 0.35) }}><Icon name="clock" size={Math.round(metaSize * 1.15)} color={TOKENS.white} strokeWidth={2.2} />{hours}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(ctaFont * 0.5), alignSelf: 'flex-start', background: TOKENS.white, color: TOKENS.red, borderRadius: 999, fontFamily: TOKENS.fontDisplay, fontWeight: 700, fontSize: ctaFont, padding: `${Math.round(ctaFont * 0.75)}px ${Math.round(ctaFont * 1.35)}px`, marginTop: Math.round(titleSize * 0.16) }}>
            {ctaLabel}<Icon name="arrow-right" size={Math.round(ctaFont * 1.1)} color={TOKENS.red} strokeWidth={2.4} />
          </div>
        </div>
      </div>
    </div>
  );
}
