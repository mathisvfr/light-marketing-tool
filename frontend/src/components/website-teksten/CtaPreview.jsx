export default function CtaPreview({ getValue }) {
  return (
    <div className="wtp-cta">
      <div className="wtp-cta-content">
        <div>
          <h3 className="wtp-cta-title">{getValue('cta.title') || 'Call-to-action titel'}</h3>
          <p className="wtp-cta-body">{getValue('cta.body') || 'CTA tekst'}</p>
        </div>
        <span className="wtp-btn wtp-btn-white">{getValue('cta.btn') || 'Knop'}</span>
      </div>
    </div>
  );
}
