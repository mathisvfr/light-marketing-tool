/* Photo feature — branded overlay on a warehouse/logistics/food photo, full-bleed.
   Bottom-anchored copy below ~1.3 aspect, left-anchored above it — pass the
   platform's own feed canvas: instagram 1080x1080 · facebook 1200x630 · linkedin 1200x627
   Props:
     photoSrc     full-bleed photo (data URI/URL, required)
     eyebrow      small caps line above the headline
     headline     main line, white (required)
     badgeLabel   small pill, e.g. "SNA-gecertificeerd" — omit to hide
     logoSrc      optional image — else a text Wordmark is used
*/
import { TOKENS } from './tokens.js';
import { LOGO_COLOR } from './logos.js';
import { Icon } from './icons.jsx';

export function PhotoFeaturePost({ width, height, photoSrc, eyebrow = 'Light Personeelsdiensten', headline = 'De juiste mensen, op de juiste plek.', badgeLabel = 'Bekijk vacatures', badgeIcon = 'arrow-right', logoSrc = LOGO_COLOR }) {
  const wide = width / height > 1.3;
  const base = Math.min(width, height);
  const pad = Math.round(base * 0.075);
  const logoSize = Math.round(base * 0.09);
  const eyebrowSize = Math.max(12, Math.round(base * 0.028));
  const headSize = Math.round(base * (wide ? 0.075 : 0.082));
  const badgeFont = Math.max(12, Math.round(base * 0.024));

  const gradient = wide
    ? 'linear-gradient(90deg, rgba(31,33,35,0.85) 0%, rgba(31,33,35,0.55) 45%, rgba(31,33,35,0.05) 100%)'
    : 'linear-gradient(180deg, rgba(31,33,35,0.05) 0%, rgba(31,33,35,0.35) 55%, rgba(31,33,35,0.88) 100%)';

  const Logo = () => <img src={logoSrc} style={{ height: logoSize }} />;

  return (
    <div style={{ width, height, position: 'relative', display: 'flex' }}>
      <img src={photoSrc} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', inset: 0, background: gradient }} />
      <div style={{ position: 'absolute', top: pad, left: pad, display: 'flex', background: 'rgba(255,255,255,0.94)', borderRadius: 10, padding: `${Math.round(logoSize * 0.32)}px ${Math.round(logoSize * 0.5)}px` }}>
        <Logo />
      </div>
      <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: wide ? 'center' : 'flex-end', padding: pad, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: Math.round(headSize * 0.22), maxWidth: wide ? Math.round(width * 0.56) : '100%' }}>
          <div style={{ display: 'flex', fontFamily: TOKENS.fontDisplay, fontWeight: 700, fontSize: eyebrowSize, color: 'rgba(255,255,255,0.85)', letterSpacing: Math.round(eyebrowSize * 0.16), textTransform: 'uppercase' }}>{eyebrow}</div>
          <div style={{ display: 'flex', fontFamily: TOKENS.fontDisplay, fontWeight: 800, fontSize: headSize, color: TOKENS.white, lineHeight: 1.08, letterSpacing: -0.5 }}>{headline}</div>
          {badgeLabel ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(badgeFont * 0.5), alignSelf: 'flex-start', background: TOKENS.white, color: TOKENS.red, borderRadius: 999, fontFamily: TOKENS.fontDisplay, fontWeight: 700, fontSize: badgeFont, padding: `${Math.round(badgeFont * 0.6)}px ${Math.round(badgeFont * 1.1)}px`, marginTop: Math.round(headSize * 0.18) }}>
              <Icon name={badgeIcon} size={Math.round(badgeFont * 1.3)} color={TOKENS.red} strokeWidth={2.4} />{badgeLabel}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
