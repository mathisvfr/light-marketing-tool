export default function ServicesPreview({ getValue }) {
  const cards = [
    { title: 'services.card1_title', body: 'services.card1_body' },
    { title: 'services.card2_title', body: 'services.card2_body' },
    { title: 'services.card3_title', body: 'services.card3_body' },
    { title: 'services.card4_title', body: 'services.card4_body' },
  ];

  return (
    <div className="wtp-services">
      <h3 className="wtp-services-title">{getValue('services.title') || 'Diensten'}</h3>
      <p className="wtp-services-intro">{getValue('services.intro') || 'Introductietekst'}</p>
      <div className="wtp-services-grid">
        {cards.map((card, i) => (
          <div key={i} className="wtp-service-card">
            <div className="wtp-service-icon" />
            <h4 className="wtp-service-title">{getValue(card.title) || `Dienst ${i + 1}`}</h4>
            <p className="wtp-service-body">{getValue(card.body) || 'Beschrijving'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
