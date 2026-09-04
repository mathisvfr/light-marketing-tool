const h = require('../shared/h');
const { TOKENS } = require('../shared/tokens');
const { LOGO_COLOR } = require('../shared/logos');

function blogHeader({ width, height, title, category, logoSrc }) {
  title = title || 'Blog artikel';
  category = category || 'Bedrijfsnieuws';
  logoSrc = logoSrc || LOGO_COLOR;

  const wide = width / height > 1.3;
  const base = Math.min(width, height);
  const pad = Math.round(base * (wide ? 0.08 : 0.06));
  const titleSize = Math.round(base * (wide ? 0.09 : 0.065));
  const catSize = Math.max(14, Math.round(base * (wide ? 0.035 : 0.025)));
  const logoSize = Math.round(base * (wide ? 0.1 : 0.08));

  // Category color mapping
  const catColors = {
    'Uitzendwerk': TOKENS.red,
    'Bedrijfsnieuws': TOKENS.grey700,
    'Voor werkzoekenden': '#2563eb',
    'Voor opdrachtgevers': '#059669',
    'Wet- en regelgeving': '#7c3aed',
  };
  const catColor = catColors[category] || TOKENS.red;

  return h('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      width,
      height,
      background: `linear-gradient(160deg, ${TOKENS.grey900} 0%, #2a2d30 60%, ${TOKENS.grey800} 100%)`,
      padding: pad,
      fontFamily: TOKENS.fontDisplay,
      color: TOKENS.white,
    },
  },
    // Top: category pill + logo
    h('div', {
      style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
    },
      h('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          background: catColor,
          color: TOKENS.white,
          borderRadius: 999,
          padding: `${Math.round(catSize * 0.5)}px ${Math.round(catSize * 1.1)}px`,
          fontSize: catSize,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },
      }, category),
      h('img', {
        src: logoSrc,
        width: logoSize,
        height: Math.round(logoSize * 0.4),
        style: { objectFit: 'contain' },
      })
    ),
    // Bottom: title + accent bar
    h('div', {
      style: { display: 'flex', flexDirection: 'column', gap: Math.round(pad * 0.4) },
    },
      h('div', {
        style: {
          width: Math.round(base * 0.08),
          height: 4,
          background: TOKENS.red,
          borderRadius: 2,
        },
      }),
      h('div', {
        style: {
          fontSize: titleSize,
          fontWeight: 800,
          lineHeight: 1.15,
          letterSpacing: -0.5,
          maxWidth: '90%',
        },
      }, title.length > 80 ? title.substring(0, 77) + '...' : title)
    )
  );
}

module.exports = blogHeader;
