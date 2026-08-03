/* Vacancy post — job title + location + sector tag, meant to be generated per
   item from the XML vacatures feed. Stacked (photo-top) below ~1.3 aspect,
   side-by-side (photo-right) above it — pass the platform's own feed canvas:
     instagram 1080x1080 · facebook 1200x630 · linkedin 1200x627
   Props:
     photoSrc       job/sector photo (data URI/URL, required)
     category       sector label, e.g. "Logistiek"
     categoryIcon   icon name: truck | factory | sparkles | briefcase
     title          job title (required)
     location       default "Rotterdam"
     hours          default "Fulltime"
     ctaLabel       CTA pill text
     logoSrc        optional image — else a text Wordmark is used
*/
import { TOKENS } from './tokens.js';
import { LOGO_COLOR } from './logos.js';
import { Icon } from './icons.jsx';

export function VacancyPost({ width, height, photoSrc, category = 'Logistiek', categoryIcon = 'truck', title = 'Meewerkend chauffeur', location = 'Rotterdam', hours = 'Fulltime', ctaLabel = 'Solliciteer direct', logoSrc = LOGO_COLOR }) {
  const wide = width / height > 1.3;
  const base = Math.min(width, height);
  const pad = Math.round(base * (wide ? 0.11 : 0.07));
  const pillFont = Math.max(15, Math.round(base * (wide ? 0.044 : 0.028)));
  const titleSize = Math.round(base * (wide ? 0.15 : 0.078));
  const metaSize = Math.max(15, Math.round(base * (wide ? 0.05 : 0.03)));
  const ctaFont = Math.max(16, Math.round(base * (wide ? 0.05 : 0.03)));
  const logoSize = Math.round(base * (wide ? 0.135 : 0.095));

  const Pill = ({ children, bg, color }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(pillFont * 0.5), background: bg, color, borderRadius: 999, padding: `${Math.round(pillFont * 0.55)}px ${Math.round(pillFont * 1.1)}px`, fontFamily: TOKENS.fontDisplay, fontWeight: 700, fontSize: pillFont, textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {children}
    </div>
  );
  const Meta = () => (
    <div style={{ display: 'flex', gap: Math.round(metaSize * 1.4), fontFamily: TOKENS.fontBody, fontWeight: 600, fontSize: metaSize, color: TOKENS.grey600 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(metaSize * 0.4) }}><Icon name="map-pin" size={Math.round(metaSize * 1.2)} color={TOKENS.red} strokeWidth={2.2} />{location}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(metaSize * 0.4) }}><Icon name="clock" size={Math.round(metaSize * 1.2)} color={TOKENS.red} strokeWidth={2.2} />{hours}</div>
    </div>
  );
  const Cta = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(ctaFont * 0.5), background: TOKENS.red, color: TOKENS.white, borderRadius: 999, padding: `${Math.round(ctaFont * 0.7)}px ${Math.round(ctaFont * 1.3)}px`, fontFamily: TOKENS.fontDisplay, fontWeight: 700, fontSize: ctaFont }}>
      {ctaLabel}<Icon name="arrow-right" size={Math.round(ctaFont * 1.15)} color={TOKENS.white} strokeWidth={2.4} />
    </div>
  );
  const Logo = () => <img src={logoSrc} style={{ height: logoSize }} />;

  if (wide) {
    const photoW = Math.round(width * 0.4);
    return (
      <div style={{ width, height, background: TOKENS.white, display: 'flex', fontFamily: TOKENS.fontBody }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: pad }}>
          <Pill bg={TOKENS.redSoft} color={TOKENS.red}><Icon name={categoryIcon} size={Math.round(pillFont * 1.3)} color={TOKENS.red} strokeWidth={2.4} />{category}</Pill>
          <div style={{ display: 'flex', flexDirection: 'column', gap: Math.round(titleSize * 0.3) }}>
            <div style={{ fontFamily: TOKENS.fontDisplay, fontWeight: 800, fontSize: titleSize, color: TOKENS.grey900, lineHeight: 1.05, letterSpacing: -0.5 }}>{title}</div>
            <Meta />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Cta />
            <Logo />
          </div>
        </div>
        <div style={{ width: photoW, height: '100%', position: 'relative' }}>
          <img src={photoSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      </div>
    );
  }

  const photoH = Math.round(height * 0.5);
  const stripFont = Math.max(15, Math.round(base * 0.026));
  return (
    <div style={{ width, height, background: TOKENS.white, display: 'flex', flexDirection: 'column', fontFamily: TOKENS.fontBody }}>
      <div style={{ height: photoH, position: 'relative', display: 'flex' }}>
        <img src={photoSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', top: pad, left: pad, display: 'flex' }}>
          <Pill bg={TOKENS.red} color={TOKENS.white}><Icon name={categoryIcon} size={Math.round(pillFont * 1.3)} color={TOKENS.white} strokeWidth={2.4} />{category}</Pill>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', background: TOKENS.red, color: TOKENS.white, fontFamily: TOKENS.fontDisplay, fontWeight: 700, fontSize: stripFont, textTransform: 'uppercase', letterSpacing: 1, padding: `${Math.round(stripFont * 0.7)}px ${pad}px` }}>
        Wij zoeken
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: pad }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: Math.round(titleSize * 0.32) }}>
          <div style={{ fontFamily: TOKENS.fontDisplay, fontWeight: 800, fontSize: titleSize, color: TOKENS.grey900, lineHeight: 1.05, letterSpacing: -0.5 }}>{title}</div>
          <Meta />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Cta />
          <Logo />
        </div>
      </div>
    </div>
  );
}
