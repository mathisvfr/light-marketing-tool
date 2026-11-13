export default function FooterPreview({ getValue }) {
  return (
    <div className="wtp-footer">
      <div className="wtp-footer-content">
        <div className="wtp-footer-brand">
          <div className="wtp-footer-logo" />
          <p className="wtp-footer-tagline">{getValue('footer.tagline') || 'Slogan'}</p>
        </div>
        <div className="wtp-footer-bottom">
          <span className="wtp-footer-copyright">{getValue('footer.copyright') || 'Copyright'}</span>
        </div>
      </div>
    </div>
  );
}
