const h = require('../shared/h');
const { TOKENS } = require('../shared/tokens');
const { LOGO_WHITE } = require('../shared/logos');
const { createIcon } = require('../shared/icons');

function storyPost({ width, height, photoSrc, category, categoryIcon, title, location, hours, ctaLabel, logoSrc }) {
  width = width || 1080;
  height = height || 1920;
  category = category || 'Logistiek';
  categoryIcon = categoryIcon || 'truck';
  title = title || 'Meewerkend chauffeur';
  location = location || 'Rotterdam';
  hours = hours || 'Fulltime';
  ctaLabel = ctaLabel || 'Solliciteer, link in bio';
  logoSrc = logoSrc || LOGO_WHITE;

  const pad = Math.round(width * 0.0667);
  const logoSize = Math.round(width * 0.1);
  const pillFont = Math.round(width * 0.026);
  const eyebrowSize = Math.round(width * 0.0296);
  const titleSize = Math.round(width * 0.096);
  const metaSize = Math.round(width * 0.0333);
  const ctaFont = Math.round(width * 0.0333);
  const diagonalH = Math.round(width * 0.12);
  const panelH = Math.round(height * 0.4);

  return h('div', {
    style: { width, height, position: 'relative', display: 'flex', background: TOKENS.grey900 },
  },
    photoSrc ? h('img', { src: photoSrc, style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' } }) : null,
    h('div', { style: { position: 'absolute', inset: 0, background: 'rgba(31,33,35,0.18)' } }),
    // Logo top-left
    h('div', { style: { position: 'absolute', top: pad, left: pad, display: 'flex' } },
      h('img', { src: logoSrc, style: { height: logoSize } })
    ),
    // Category pill top-right
    h('div', {
      style: { position: 'absolute', top: pad, right: pad, display: 'flex', alignItems: 'center', gap: Math.round(pillFont * 0.55), background: TOKENS.red, color: TOKENS.white, borderRadius: 999, padding: Math.round(pillFont * 0.65) + 'px ' + Math.round(pillFont * 1.15) + 'px', fontFamily: TOKENS.fontDisplay, fontWeight: 700, fontSize: pillFont, textTransform: 'uppercase', letterSpacing: 0.5 },
    }, createIcon(categoryIcon, Math.round(pillFont * 1.15), TOKENS.white, 2.4), category),
    // Bottom red panel with angled top
    h('div', {
      style: { display: 'flex', position: 'absolute', left: 0, bottom: 0, width: width, height: panelH },
    },
      h('svg', { width: width, height: panelH, style: { position: 'absolute', top: 0, left: 0 } },
        h('polygon', { points: '0,' + diagonalH + ' ' + width + ',0 ' + width + ',' + panelH + ' 0,' + panelH, fill: TOKENS.red })
      ),
      h('div', {
        style: { position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 ' + pad + 'px ' + Math.round(panelH * 0.12) + 'px', boxSizing: 'border-box', gap: Math.round(titleSize * 0.24) },
      },
        h('div', {
          style: { display: 'flex', fontFamily: TOKENS.fontDisplay, fontWeight: 700, fontSize: eyebrowSize, color: 'rgba(255,255,255,0.85)', letterSpacing: Math.round(eyebrowSize * 0.16), textTransform: 'uppercase' },
        }, 'Wij zoeken'),
        h('div', {
          style: { display: 'flex', fontFamily: TOKENS.fontDisplay, fontWeight: 800, fontSize: titleSize, color: TOKENS.white, lineHeight: 1.05, letterSpacing: -0.5 },
        }, title),
        h('div', {
          style: { display: 'flex', gap: Math.round(metaSize * 0.9), fontFamily: TOKENS.fontBody, fontWeight: 600, fontSize: metaSize, color: TOKENS.white },
        },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: Math.round(metaSize * 0.35) } },
            createIcon('map-pin', Math.round(metaSize * 1.15), TOKENS.white, 2.2), location),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: Math.round(metaSize * 0.35) } },
            createIcon('clock', Math.round(metaSize * 1.15), TOKENS.white, 2.2), hours)
        ),
        h('div', {
          style: { display: 'flex', alignItems: 'center', gap: Math.round(ctaFont * 0.5), alignSelf: 'flex-start', background: TOKENS.white, color: TOKENS.red, borderRadius: 999, fontFamily: TOKENS.fontDisplay, fontWeight: 700, fontSize: ctaFont, padding: Math.round(ctaFont * 0.75) + 'px ' + Math.round(ctaFont * 1.35) + 'px', marginTop: Math.round(titleSize * 0.16) },
        }, ctaLabel, createIcon('arrow-right', Math.round(ctaFont * 1.1), TOKENS.red, 2.4))
      )
    )
  );
}

module.exports = storyPost;
