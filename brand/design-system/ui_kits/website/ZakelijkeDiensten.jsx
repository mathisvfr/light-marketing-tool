// ZakelijkeDiensten — "Zakelijke diensten" page.
// Mirrors lightpersoneelsdiensten.nl/services/zakelijke-diensten/
function ZakelijkeDiensten({ onNav }) {
  const diensten = [
    { icon: 'file-text', title: 'Administratieve diensten & recruitment',
      body: 'Wij praten u graag bij over hoe Light u en uw bedrijf tijd, aansprakelijkheid en kosten kan besparen — van werving tot administratie.' },
    { icon: 'activity', title: 'Real-time en overzichtelijk',
      body: 'Wij analyseren uw personeelsprocessen, maken ze inzichtelijk en monitoren periodiek de geboekte werkkosten. Volledig inzicht, altijd actueel.' },
    { icon: 'headphones', title: 'Office support',
      body: 'Incidenteel of structureel administratieve ondersteuning — bij vakantie of ziekte van vast kantoorpersoneel, of als vaste managementondersteuning.' },
    { icon: 'users', title: 'HRM-advies',
      body: 'Begeleiding van uw HRM-beleid, salarisadministratie en werkhervattingstrajecten. Wij ondersteunen bij vragen en werkzaamheden waar nodig.' },
  ];
  const voordelen = [
    'Optimale flexibiliteit',
    'Alleen facturatie voor de gewerkte uren die u aanlevert',
    'Geen uitbetaling van vakantiedaguren en vakantiegeld',
    'Geen zorgen over CAO- of wetswijzigingen',
    'Geen sociale premies, loonbelastingen of pensioenpremies',
    'Geen financiële risico’s of ziekteverzuimverzekering',
  ];
  return (
    <>
      <PageHero
        eyebrow="Zakelijke diensten"
        title="Professionele dienstverlening voor bedrijven"
        intro="Op zoek naar een organisatie die ontzorgt? Door onze kennis van de branche weten wij wat er speelt op de markt én op de werkvloer. Wij geven persoonlijk advies dat aansluit bij uw bedrijf."
        image="https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=900&q=70"
      />

      <ContentSection>
        <SectionEyebrow>Onze dienstverlening</SectionEyebrow>
        <h2 className="light-h2" style={{ marginBottom: 28, maxWidth: 720 }}>Ontzorgen van werving tot administratie</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
          {diensten.map((d) => (
            <FeatureCard key={d.title} icon={d.icon} title={d.title}>{d.body}</FeatureCard>
          ))}
        </div>
      </ContentSection>

      <ContentSection soft>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 52, alignItems: 'center' }}>
          <div>
            <SectionEyebrow>Onze pool</SectionEyebrow>
            <h2 className="light-h2" style={{ marginBottom: 16 }}>Gemotiveerde, flexibele uitzendkrachten</h2>
            <Para style={{ fontSize: 16 }}>
              Wij kennen onze uitzendkrachten persoonlijk. Daardoor geven wij een optimale invulling aan uw
              tijdelijke of langdurige vacatures. Door onze met zorg samengestelde pool is snel schakelen bij
              piekbelasting, ziekte of vakantie geen enkel probleem.
            </Para>
            <Para style={{ fontSize: 16, marginBottom: 0 }}>
              Bij ons vindt u dé flexkracht die echt past bij uw bedrijf. Wij conformeren ons aan de ABU-cao, zodat
              u optimaal profiteert van de flexibiliteit die deze biedt — een nieuwe medewerker start in fase A.
            </Para>
          </div>
          <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '32px 34px', boxShadow: 'var(--shadow-xs)' }}>
            <h3 className="light-h3" style={{ marginBottom: 20 }}>De voordelen op een rij</h3>
            <CheckList items={voordelen} columns={1} />
          </div>
        </div>
      </ContentSection>
    </>
  );
}
