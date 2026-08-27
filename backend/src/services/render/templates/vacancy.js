const h = require('../shared/h');
const { TOKENS } = require('../shared/tokens');
const { LOGO_COLOR } = require('../shared/logos');
const { createIcon } = require('../shared/icons');

function vacancyPost({ width, height, photoSrc, category, categoryIcon, title, location, hours, ctaLabel, logoSrc }) {
  category = category || 'Logistiek';
  categoryIcon = categoryIcon || 'truck';
  title = title || 'Meewerkend chauffeur';
  location = location || 'Rotterdam';
  hours = hours || 'Fulltime';
  ctaLabel = ctaLabel || 'Solliciteer direct';
  logoSrc = logoSrc || LOGO_COLOR;

  const wide = width / height > 1.3;
  const base = Math.min(width, height);
  // Branded fill for the photo area when no photo is supplied, so an
  // auto-generated vacancy visual never renders with a blank/empty panel.
  const photoFallback = `linear-gradient(135deg, ${TOKENS.grey900} 0%, ${TOKENS.red} 100%)`;
  const pad = Math.round(base * (wide ? 0.11 : 0.07));
  const pillFont = Math.max(15, Math.round(base * (wide ? 0.044 : 0.028)));
  const titleSize = Math.round(base * (wide ? 0.15 : 0.078));
  const metaSize = Math.max(15, Math.round(base * (wide ? 0.05 : 0.03)));
  const ctaFont = Math.max(16, Math.round(base * (wide ? 0.05 : 0.03)));
  const logoSize = Math.round(base * (wide ? 0.135 : 0.095));

  function pill(bg, color, children) {
    return h('div', {
      style: { display: 'flex', alignItems: 'center', gap: Math.round(pillFont * 0.5), background: bg, color: color, borderRadius: 999, padding: pillFont * 0.55 + 'px ' + pillFont * 1.1 + 'px', fontFamily: TOKENS.fontDisplay, fontWeight: 700, fontSize: pillFont, textTransform: 'uppercase', letterSpacing: 0.5 },
    }, ...children);
  }

  function meta() {
    return h('div', {
      style: { display: 'flex', gap: Math.round(metaSize * 1.4), fontFamily: TOKENS.fontBody, fontWeight: 600, fontSize: metaSize, color: TOKENS.grey600 },
    },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: Math.round(metaSize * 0.4) } },
        createIcon('map-pin', Math.round(metaSize * 1.2), TOKENS.red, 2.2), location),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: Math.round(metaSize * 0.4) } },
        createIcon('clock', Math.round(metaSize * 1.2), TOKENS.red, 2.2), hours)
    );
  }

  function cta() {
    return h('div', {
      style: { display: 'flex', alignItems: 'center', gap: Math.round(ctaFont * 0.5), background: TOKENS.red, color: TOKENS.white, borderRadius: 999, padding: Math.round(ctaFont * 0.7) + 'px ' + Math.round(ctaFont * 1.3) + 'px', fontFamily: TOKENS.fontDisplay, fontWeight: 700, fontSize: ctaFont },
    }, ctaLabel, createIcon('arrow-right', Math.round(ctaFont * 1.15), TOKENS.white, 2.4));
  }

  function logo() {
    return h('img', { src: logoSrc, style: { height: logoSize } });
  }

  if (wide) {
    const photoW = Math.round(width * 0.4);
    return h('div', {
      style: { width, height, background: TOKENS.white, display: 'flex', fontFamily: TOKENS.fontBody },
    },
      h('div', {
        style: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: pad },
      },
        pill(TOKENS.redSoft, TOKENS.red, [createIcon(categoryIcon, Math.round(pillFont * 1.3), TOKENS.red, 2.4), category]),
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: Math.round(titleSize * 0.3) } },
          h('div', { style: { fontFamily: TOKENS.fontDisplay, fontWeight: 800, fontSize: titleSize, color: TOKENS.grey900, lineHeight: 1.05, letterSpacing: -0.5 } }, title),
          meta()
        ),
        h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
          cta(), logo()
        )
      ),
      h('div', { style: { width: photoW, height: '100%', position: 'relative', display: 'flex', background: photoSrc ? TOKENS.grey900 : photoFallback } },
        photoSrc ? h('img', { src: photoSrc, style: { width: '100%', height: '100%', objectFit: 'cover' } }) : null
      )
    );
  }

  // Square / portrait layout
  const photoH = Math.round(height * 0.5);
  const stripFont = Math.max(15, Math.round(base * 0.026));

  return h('div', {
    style: { width, height, background: TOKENS.white, display: 'flex', flexDirection: 'column', fontFamily: TOKENS.fontBody },
  },
    h('div', { style: { height: photoH, position: 'relative', display: 'flex', background: photoSrc ? TOKENS.grey900 : photoFallback } },
      photoSrc ? h('img', { src: photoSrc, style: { width: '100%', height: '100%', objectFit: 'cover' } }) : null,
      h('div', { style: { position: 'absolute', top: pad, left: pad, display: 'flex' } },
        pill(TOKENS.red, TOKENS.white, [createIcon(categoryIcon, Math.round(pillFont * 1.3), TOKENS.white, 2.4), category])
      )
    ),
    h('div', {
      style: { display: 'flex', alignItems: 'center', background: TOKENS.red, color: TOKENS.white, fontFamily: TOKENS.fontDisplay, fontWeight: 700, fontSize: stripFont, textTransform: 'uppercase', letterSpacing: 1, padding: Math.round(stripFont * 0.7) + 'px ' + pad + 'px' },
    }, 'Wij zoeken'),
    h('div', {
      style: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: pad },
    },
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: Math.round(titleSize * 0.32) } },
        h('div', { style: { fontFamily: TOKENS.fontDisplay, fontWeight: 800, fontSize: titleSize, color: TOKENS.grey900, lineHeight: 1.05, letterSpacing: -0.5 } }, title),
        meta()
      ),
      h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        cta(), logo()
      )
    )
  );
}

module.exports = vacancyPost;
