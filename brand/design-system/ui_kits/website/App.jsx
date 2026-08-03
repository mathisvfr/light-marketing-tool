// App — Light marketing site. Multi-page: Home + Over ons, Zakelijke diensten,
// Vacatures en Contact. Header/Footer blijven staan; de body wisselt op de
// actieve nav-keuze.
function App() {
  const [active, setActive] = React.useState('Home');
  const [t, setTweak] = useTweaks(window.TWEAK_DEFAULTS || { logoBg: 'soft', headingWeight: 700, statement: 'De juiste mensen, op de juiste plek.' });

  React.useEffect(() => { if (window.lucide) lucide.createIcons(); }, [active, t]);
  React.useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }); }, [active]);

  const headerBg = t.logoBg === 'soft' ? 'var(--grey-50)' : '#fff';
  const STATEMENTS = [
    'Wij houden de productie draaiend.',
    'De productie moet draaien.',
    'Wij kennen de klappen van de zweep.',
    'Van begin tot eindproduct — wij regelen het.',
    'De juiste mensen, op de juiste plek.',
    'De productie moet draaien. Punt.',
  ];

  const onNav = (label) => setActive(label);

  let body;
  switch (active) {
    case 'Over ons': body = <OverOns onNav={onNav} />; break;
    case 'Zakelijke diensten': body = <ZakelijkeDiensten onNav={onNav} />; break;
    case 'Vacatures': body = <VacaturesPage onNav={onNav} />; break;
    case 'Contact': body = <ContactPage onNav={onNav} />; break;
    default:
      body = (
        <>
          <Hero onNav={onNav} />
          <ServiceTiles onNav={onNav} />
          <VacancyFeed onNav={onNav} />
        </>
      );
  }

  return (
    <div className="light-body" style={{ background: '#fff' }}>
      <style>{`
        .light-h1, .light-h2 { font-weight: ${t.headingWeight} !important; }
        .cta-title { font-weight: ${t.headingWeight} !important; }
      `}</style>
      <Header onNav={onNav} active={active} headerBg={headerBg} />
      {body}
      {active !== 'Contact' && <CtaBand onNav={onNav} statement={t.statement} />}
      <Footer onNav={onNav} />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Logo" />
        <TweakRadio label="Logo-achtergrond" value={t.logoBg}
          options={[{ value: 'white', label: 'Wit' }, { value: 'soft', label: 'Lichtgrijs' }]}
          onChange={(v) => setTweak('logoBg', v)} />
        <TweakSection label="Typografie" />
        <TweakRadio label="Kopgewicht" value={t.headingWeight}
          options={[{ value: 800, label: '800' }, { value: 700, label: '700' }, { value: 600, label: '600' }]}
          onChange={(v) => setTweak('headingWeight', v)} />
        <TweakSection label="Statement" />
        <TweakSelect label="CTA-tekst" value={t.statement}
          options={STATEMENTS} onChange={(v) => setTweak('statement', v)} />
      </TweaksPanel>
    </div>
  );
}
