export default function HeroPreview({ getValue }) {
  return (
    <div className="wtp-hero">
      {getValue('hero.badge') && (
        <span className="wtp-hero-badge">{getValue('hero.badge')}</span>
      )}
      <h2 className="wtp-hero-title">{getValue('hero.title') || 'Koptekst'}</h2>
      <p className="wtp-hero-lead">{getValue('hero.lead') || 'Ondertitel'}</p>
      <div className="wtp-hero-buttons">
        <span className="wtp-btn wtp-btn-white">{getValue('hero.btn_vacatures') || 'Vacatures'}</span>
        <span className="wtp-btn wtp-btn-outline">{getValue('hero.btn_contact') || 'Contact'}</span>
      </div>
    </div>
  );
}
