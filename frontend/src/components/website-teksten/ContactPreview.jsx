export default function ContactPreview({ getValue }) {
  return (
    <div className="wtp-contact">
      <h3 className="wtp-contact-title">{getValue('contact.title') || 'Contact'}</h3>
      <p className="wtp-contact-intro">{getValue('contact.intro') || 'Introductietekst'}</p>
      <div className="wtp-contact-cards">
        <div className="wtp-contact-card">
          <h4>{getValue('contact.audience1_title') || 'Werkzoekenden'}</h4>
          <p>{getValue('contact.audience1_body') || 'Tekst voor werkzoekenden'}</p>
        </div>
        <div className="wtp-contact-card">
          <h4>{getValue('contact.audience2_title') || 'Opdrachtgevers'}</h4>
          <p>{getValue('contact.audience2_body') || 'Tekst voor opdrachtgevers'}</p>
        </div>
      </div>
    </div>
  );
}
