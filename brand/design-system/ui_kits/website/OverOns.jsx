// OverOns — "Over ons" page. Mirrors lightpersoneelsdiensten.nl/services/light-personeelsdiensten-b-v/
function OverOns({ onNav }) {
  const values = [
    { icon: 'shield-check', title: 'Betrouwbaar', body: 'Al jarenlang een vaste waarde voor opdrachtgevers in productie, logistiek en schoonmaak.' },
    { icon: 'zap', title: 'Direct', body: 'Korte lijnen en snel schakelen — u heeft één vast aanspreekpunt dat de werkvloer kent.' },
    { icon: 'lightbulb', title: 'Oplossingsgericht', body: 'Piek, ziekte of vakantie: wij vinden dé medewerker die echt past in het team.' },
  ];
  const biedt = [
    'Service en kwaliteit',
    'Efficiënt en doelgericht werken',
    'Administratieve verlichting, ondersteuning waar nodig',
    'Optimale kostenbesparing',
  ];
  return (
    <>
      <PageHero
        eyebrow="Over ons"
        title="Light Personeelsdiensten B.V."
        intro="Specialist in het uitzenden van productie-, logistiek en schoonmaakpersoneel. Wij kennen de klappen van de zweep."
        image="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=900&q=70"
      />

      <ContentSection>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 52 }}>
          {values.map((v) => (
            <FeatureCard key={v.title} icon={v.icon} title={v.title}>{v.body}</FeatureCard>
          ))}
        </div>

        <div style={{ maxWidth: 780 }}>
          <Para>
            Omdat wij al jarenlang in de productiebranche medewerkers mogen inzetten van het begin tot aan het
            eindproduct, kennen wij de klappen van de zweep. Het vinden van deze specifieke medewerkers is een
            vak apart — en laat dit nu net ons vak zijn.
          </Para>
          <Para>
            Wij gaan graag direct aan de slag met het benaderen van kandidaten uit ons bestand van werkzoekenden
            en via onze socials. Het invullen van langetermijnvacatures, snel schakelen bij piekperiodes, vervanging
            van een zieke medewerker of het opvangen van een vakantieperiode: voor ons geen probleem. Wij vinden
            altijd dé medewerker die echt past in het team.
          </Para>
          <Para>
            Omdat wij ons conformeren aan de ABU-cao kunt u optimaal gebruikmaken van de flexibiliteit die deze
            biedt. Een nieuwe medewerker start in fase A en is zo een jaar lang flexibel inzetbaar — de uitgelezen
            kans om het functioneren te beoordelen zonder direct vast te zitten aan een contract voor bepaalde of
            onbepaalde tijd.
          </Para>
          <Para style={{ marginBottom: 0 }}>
            Geen dag is hetzelfde, dus een gedegen HRM-beleid is essentieel. Daarom bieden wij ook administratieve
            ondersteuning waar nodig: van algemene managementondersteuning en begeleiding van het HRM-beleid tot
            salarisadministratie en werkhervattingstrajecten.
          </Para>
        </div>
      </ContentSection>

      <ContentSection soft>
        <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', gap: 48, alignItems: 'center' }}>
          <div>
            <SectionEyebrow>Wij bieden</SectionEyebrow>
            <h2 className="light-h2">Waar u op kunt rekenen</h2>
          </div>
          <CheckList items={biedt} columns={1} />
        </div>
      </ContentSection>
    </>
  );
}
