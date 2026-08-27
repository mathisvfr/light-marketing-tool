const h = require('../shared/h');
const { TOKENS } = require('../shared/tokens');
const { LOGO_COLOR } = require('../shared/logos');
const { createIcon } = require('../shared/icons');

function photoFeaturePost({ width, height, photoSrc, eyebrow, headline, badgeLabel, badgeIcon, logoSrc }) {
  eyebrow = eyebrow || 'Light Personeelsdiensten';
  headline = headline || 'De juiste mensen, op de juiste plek.';
  badgeLabel = badgeLabel !== undefined ? badgeLabel : 'Bekijk vacatures';
  badgeIcon = badgeIcon || 'arrow-right';
  logoSrc = logoSrc || LOGO_COLOR;

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

  return h('div', {
    style: { width, height, position: 'relative', display: 'flex', background: photoSrc ? TOKENS.grey900 : `linear-gradient(135deg, ${TOKENS.grey900} 0%, ${TOKENS.red} 100%)` },
  },
    photoSrc ? h('img', { src: photoSrc, style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' } }) : null,
    h('div', { style: { position: 'absolute', inset: 0, background: gradient } }),
    h('div', {
      style: { position: 'absolute', top: pad, left: pad, display: 'flex', background: 'rgba(255,255,255,0.94)', borderRadius: 10, padding: Math.round(logoSize * 0.32) + 'px ' + Math.round(logoSize * 0.5) + 'px' },
    },
      h('img', { src: logoSrc, style: { height: logoSize } })
    ),
    h('div', {
      style: { position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: wide ? 'center' : 'flex-end', padding: pad, boxSizing: 'border-box' },
    },
      h('div', {
        style: { display: 'flex', flexDirection: 'column', gap: Math.round(headSize * 0.22), maxWidth: wide ? Math.round(width * 0.56) : '100%' },
      },
        h('div', {
          style: { display: 'flex', fontFamily: TOKENS.fontDisplay, fontWeight: 700, fontSize: eyebrowSize, color: 'rgba(255,255,255,0.85)', letterSpacing: Math.round(eyebrowSize * 0.16), textTransform: 'uppercase' },
        }, eyebrow),
        h('div', {
          style: { display: 'flex', fontFamily: TOKENS.fontDisplay, fontWeight: 800, fontSize: headSize, color: TOKENS.white, lineHeight: 1.08, letterSpacing: -0.5 },
        }, headline),
        badgeLabel ? h('div', {
          style: { display: 'flex', alignItems: 'center', gap: Math.round(badgeFont * 0.5), alignSelf: 'flex-start', background: TOKENS.white, color: TOKENS.red, borderRadius: 999, fontFamily: TOKENS.fontDisplay, fontWeight: 700, fontSize: badgeFont, padding: Math.round(badgeFont * 0.6) + 'px ' + Math.round(badgeFont * 1.1) + 'px', marginTop: Math.round(headSize * 0.18) },
        }, createIcon(badgeIcon, Math.round(badgeFont * 1.3), TOKENS.red, 2.4), badgeLabel) : null
      )
    )
  );
}

module.exports = photoFeaturePost;
