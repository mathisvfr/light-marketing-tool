const h = require('../shared/h');
const { TOKENS } = require('../shared/tokens');
const { LOGO_WHITE } = require('../shared/logos');

function statementPost({ width, height, headline, accent, eyebrow, logoSrc }) {
  headline = headline || 'De juiste mensen,';
  accent = accent !== undefined ? accent : 'op de juiste plek.';
  eyebrow = eyebrow || 'Productie · Logistiek · Schoonmaak';
  logoSrc = logoSrc || LOGO_WHITE;

  const base = Math.min(width, height);
  const pad = Math.round(base * 0.09);
  const logoSize = Math.round(base * 0.105);
  const headSize = Math.round(base * 0.105);
  const eyebrowSize = Math.max(11, Math.round(base * 0.03));
  const barW = Math.round(base * 0.085);
  const barH = Math.max(4, Math.round(base * 0.008));

  return h('div', {
    style: { width, height, background: TOKENS.grey900, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: pad, fontFamily: TOKENS.fontBody },
  },
    h('div', { style: { display: 'flex' } },
      h('img', { src: logoSrc, style: { height: logoSize } })
    ),
    h('div', { style: { display: 'flex', flexDirection: 'column' } },
      h('div', { style: { width: barW, height: barH, background: TOKENS.red, borderRadius: 3, marginBottom: Math.round(base * 0.04) } }),
      h('div', {
        style: { display: 'flex', flexWrap: 'wrap', fontFamily: TOKENS.fontDisplay, fontWeight: 800, fontSize: headSize, lineHeight: 1.05, letterSpacing: -1, color: TOKENS.white, textAlign: 'left' },
      },
        headline,
        accent ? h('span', { style: { color: TOKENS.redTint } }, ' ' + accent) : null
      )
    ),
    h('div', {
      style: { display: 'flex', fontFamily: TOKENS.fontDisplay, fontWeight: 700, fontSize: eyebrowSize, color: TOKENS.grey400, letterSpacing: Math.round(eyebrowSize * 0.16), textTransform: 'uppercase' },
    }, eyebrow)
  );
}

module.exports = statementPost;
