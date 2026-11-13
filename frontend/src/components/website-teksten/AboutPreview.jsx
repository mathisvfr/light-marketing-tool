export default function AboutPreview({ getValue }) {
  const values = [
    { title: 'about.value1_title', body: 'about.value1_body' },
    { title: 'about.value2_title', body: 'about.value2_body' },
    { title: 'about.value3_title', body: 'about.value3_body' },
  ];

  return (
    <div className="wtp-about">
      <h3 className="wtp-about-title">{getValue('about.title') || 'Over ons'}</h3>
      <p className="wtp-about-intro">{getValue('about.intro') || 'Introductietekst'}</p>
      <div className="wtp-about-values">
        {values.map((v, i) => (
          <div key={i} className="wtp-value-card">
            <h4 className="wtp-value-title">{getValue(v.title) || `Waarde ${i + 1}`}</h4>
            <p className="wtp-value-body">{getValue(v.body) || 'Beschrijving'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
