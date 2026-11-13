export default function VacaturesPreview({ getValue }) {
  return (
    <div className="wtp-vacatures">
      <h3 className="wtp-vacatures-title">{getValue('vacatures.title') || 'Vacatures'}</h3>
      <p className="wtp-vacatures-intro">{getValue('vacatures.intro') || 'Introductietekst'}</p>
      <div className="wtp-vacatures-list">
        <div className="wtp-vacature-placeholder" />
        <div className="wtp-vacature-placeholder" />
        <div className="wtp-vacature-placeholder" />
      </div>
      <div className="wtp-vacatures-cta">
        <h4>{getValue('vacatures.cta_title') || 'CTA Titel'}</h4>
        <p>{getValue('vacatures.cta_body') || 'CTA tekst'}</p>
        <span className="wtp-btn wtp-btn-primary">{getValue('vacatures.cta_btn') || 'Knop'}</span>
      </div>
    </div>
  );
}
