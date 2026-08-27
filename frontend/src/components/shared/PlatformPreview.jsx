import './platform-preview.css';

const LOGO_INITIAL = 'L';

function extractHashtags(text) {
  if (!text) return { body: '', hashtags: [] };
  const trimmed = String(text).trim();
  const lines = trimmed.split(/\n+/);
  const lastLine = lines[lines.length - 1] || '';
  const isHashtagLine = /^(\s*#\w[\w\-]*(\s+#\w[\w\-]*)*\s*)$/.test(lastLine);
  if (!isHashtagLine) {
    return { body: trimmed, hashtags: [] };
  }
  const hashtags = lastLine.trim().split(/\s+/);
  const body = lines.slice(0, -1).join('\n').trim();
  return { body, hashtags };
}

function LinkedInPreview({ text, imagePath, brandName }) {
  const { body, hashtags } = extractHashtags(text);
  return (
    <div className="platform-preview li">
      <div className="li-header">
        <div className="li-avatar">{LOGO_INITIAL}</div>
        <div className="li-meta">
          <strong>{brandName}</strong>
          <span>Uitzendbureau · Rotterdam</span>
          <span className="li-time">Nu · 🌐</span>
        </div>
      </div>
      <p className="li-body">{body || '(nog geen tekst)'}</p>
      {hashtags.length > 0 ? (
        <div className="li-hashtags">
          {hashtags.map((tag) => (
            <span key={tag} className="li-hashtag">{tag}</span>
          ))}
        </div>
      ) : null}
      {imagePath ? (
        <div className="li-image">
          <img src={imagePath} alt="LinkedIn preview" />
        </div>
      ) : null}
      <div className="li-actions">
        <span>👍 Vind ik goed</span>
        <span>💬 Reageren</span>
        <span>↗ Delen</span>
      </div>
    </div>
  );
}

function FacebookPreview({ text, imagePath, brandName }) {
  return (
    <div className="platform-preview fb">
      <div className="fb-header">
        <div className="fb-avatar">{LOGO_INITIAL}</div>
        <div className="fb-meta">
          <strong>{brandName}</strong>
          <span>Zojuist · 🌐</span>
        </div>
      </div>
      <p className="fb-body">{text || '(nog geen tekst)'}</p>
      {imagePath ? (
        <div className="fb-image">
          <img src={imagePath} alt="Facebook preview" />
        </div>
      ) : null}
      <div className="fb-actions">
        <span>👍 Vind ik leuk</span>
        <span>💬 Reageren</span>
        <span>↗ Delen</span>
      </div>
    </div>
  );
}

function InstagramPreview({ text, imagePath, brandName }) {
  return (
    <div className="platform-preview ig">
      <div className="ig-header">
        <div className="ig-avatar">{LOGO_INITIAL}</div>
        <strong>{brandName.toLowerCase().replace(/\s+/g, '')}</strong>
        <span className="ig-time">•</span>
      </div>
      <div className="ig-image">
        {imagePath ? (
          <img src={imagePath} alt="Instagram preview" />
        ) : (
          <div className="ig-image-placeholder">Nog geen afbeelding</div>
        )}
      </div>
      <div className="ig-actions">
        <span>♡</span>
        <span>💬</span>
        <span>↗</span>
      </div>
      <p className="ig-caption">
        <strong>{brandName.toLowerCase().replace(/\s+/g, '')}</strong> {text || '(nog geen caption)'}
      </p>
    </div>
  );
}

export default function PlatformPreview({ platform, text, imagePath, brandName = 'Light Personeelsdiensten' }) {
  if (platform === 'linkedin') return <LinkedInPreview text={text} imagePath={imagePath} brandName={brandName} />;
  if (platform === 'facebook') return <FacebookPreview text={text} imagePath={imagePath} brandName={brandName} />;
  if (platform === 'instagram') return <InstagramPreview text={text} imagePath={imagePath} brandName={brandName} />;
  return null;
}
