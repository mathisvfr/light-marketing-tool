/* Statement post — bold quote/announcement on the brand-dark field. No photo.
   Renders any aspect ratio: pass the platform's exact feed-post canvas.
     instagram 1080x1080 · facebook 1200x630 · linkedin 1200x627
   Props:
     headline      leading line, plain white (required)
     accent        trailing phrase set in the red tint (optional)
     eyebrow       small caps line at the foot, e.g. sector list
     logoSrc       optional image (data URI/URL) — else a text Wordmark is used
*/
import { TOKENS } from './tokens.js';
import { LOGO_WHITE } from './logos.js';

export function StatementPost({ width, height, headline = 'De juiste mensen,', accent = 'op de juiste plek.', eyebrow = 'Productie · Logistiek · Schoonmaak', logoSrc = LOGO_WHITE }) {
  const base = Math.min(width, height);
  const pad = Math.round(base * 0.09);
  const logoSize = Math.round(base * 0.105);
  const headSize = Math.round(base * 0.105);
  const eyebrowSize = Math.max(11, Math.round(base * 0.03));
  const barW = Math.round(base * 0.085);
  const barH = Math.max(4, Math.round(base * 0.008));

  return (
    <div style={{ width, height, background: TOKENS.grey900, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: pad, fontFamily: TOKENS.fontBody }}>
      <div style={{ display: 'flex' }}>
        <img src={logoSrc} style={{ height: logoSize }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ width: barW, height: barH, background: TOKENS.red, borderRadius: 3, marginBottom: Math.round(base * 0.04) }} />
        <div style={{ fontFamily: TOKENS.fontDisplay, fontWeight: 800, fontSize: headSize, lineHeight: 1.05, letterSpacing: -1, color: TOKENS.white, textAlign: 'left' }}>
          {headline}{accent ? <span style={{ color: TOKENS.redTint }}>{' ' + accent}</span> : null}
        </div>
      </div>
      <div style={{ display: 'flex', fontFamily: TOKENS.fontDisplay, fontWeight: 700, fontSize: eyebrowSize, color: TOKENS.grey400, letterSpacing: Math.round(eyebrowSize * 0.16), textTransform: 'uppercase' }}>
        {eyebrow}
      </div>
    </div>
  );
}
