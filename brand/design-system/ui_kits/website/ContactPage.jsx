// ContactPage — "Contact" page: audience split, details, contact form, location.
function ContactPage({ onNav }) {
  const [sent, setSent] = React.useState(false);
  const submit = (e) => { e.preventDefault(); setSent(true); };

  const audiences = [
    { icon: 'building-2', tag: 'Opdrachtgevers', title: 'Personeel nodig?',
      body: 'Productie-, logistiek- of schoonmaakpersoneel nodig, of advies over uw personeelsprocessen? Onze administratie helpt u verder.',
      email: 'administratie@lightpersoneelsdiensten.nl' },
    { icon: 'briefcase', tag: 'Werkzoekenden', title: 'Op zoek naar werk?',
      body: 'Wil je aan de slag of een open sollicitatie sturen? Mail ons team en we nemen contact met je op.',
      email: 'vacature@lightpersoneelsdiensten.nl' },
  ];

  const labelStyle = { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13.5, color: 'var(--color-text)', marginBottom: 6, display: 'block' };

  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Neem contact op"
        intro="Betrouwbaar, direct en met korte lijnen. Bel ons, mail het juiste team of stuur het formulier — wij reageren snel."
      />

      <ContentSection>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 56 }}>
          {audiences.map((a) => (
            <Card key={a.tag} padding={28} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <span style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7,
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--color-primary)', background: 'var(--color-primary-soft)',
                padding: '5px 10px', borderRadius: 'var(--radius-pill)' }}>
                <i data-lucide={a.icon} style={{ width: 13, height: 13 }} />{a.tag}
              </span>
              <h3 className="light-h3" style={{ fontSize: 21 }}>{a.title}</h3>
              <p className="light-body" style={{ fontSize: 14.5, color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.6 }}>{a.body}</p>
              <a href={`mailto:${a.email}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 2,
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14.5, color: 'var(--light-red)', textDecoration: 'none' }}>
                <i data-lucide="mail" style={{ width: 16, height: 16 }} />{a.email}
              </a>
            </Card>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 52, alignItems: 'start' }}>
          {/* Details + location */}
          <div>
            <SectionEyebrow>Gegevens</SectionEyebrow>
            <h2 className="light-h2" style={{ marginBottom: 22 }}>Light Personeelsdiensten B.V.</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 28 }}>
              <ContactRow icon="map-pin" label="Adres">Selma Lagerlöfweg 63<br />3069 BT Rotterdam</ContactRow>
              <ContactRow icon="phone" label="Telefoon"><a href="tel:+31107600857" style={{ color: 'inherit', fontFamily: 'var(--font-mono)', textDecoration: 'none' }}>+31 10 760 0857</a></ContactRow>
              <ContactRow icon="badge-check" label="Certificering">Gecertificeerd door Stichting Normering Arbeid (SNA)</ContactRow>
            </div>
            {/* Location placeholder */}
            <div style={{ position: 'relative', height: 220, borderRadius: 'var(--radius-md)', overflow: 'hidden',
              border: '1px solid var(--color-border)',
              background: 'repeating-linear-gradient(135deg, var(--grey-50), var(--grey-50) 14px, var(--grey-100) 14px, var(--grey-100) 28px)' }}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <i data-lucide="map-pin" style={{ width: 26, height: 26, color: 'var(--light-red)' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-muted)' }}>kaart — Selma Lagerlöfweg 63, Rotterdam</span>
              </div>
            </div>
          </div>

          {/* Form */}
          <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '32px 34px', boxShadow: 'var(--shadow-xs)' }}>
            <h3 className="light-h3" style={{ marginBottom: 20 }}>Stuur ons een bericht</h3>
            {sent ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12, padding: '20px 0' }}>
                <span style={{ width: 48, height: 48, borderRadius: '999px', background: 'var(--color-primary-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i data-lucide="check" style={{ width: 24, height: 24, color: 'var(--light-red)' }} />
                </span>
                <h4 className="light-h4">Bedankt voor uw bericht!</h4>
                <p className="light-body" style={{ fontSize: 15, color: 'var(--color-text-muted)', margin: 0 }}>Wij nemen zo snel mogelijk contact met u op.</p>
              </div>
            ) : (
              <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <Input label="Naam" placeholder="Uw naam" required />
                  <Input label="Telefoon" type="tel" placeholder="06 …" icon="phone" />
                </div>
                <Input label="E-mail" type="email" placeholder="naam@bedrijf.nl" icon="mail" required />
                <div>
                  <label style={labelStyle}>Bericht <span style={{ color: 'var(--light-red)' }}>*</span></label>
                  <textarea required rows={5} placeholder="Waarmee kunnen wij u helpen?"
                    style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'var(--font-body)', fontSize: 15,
                      color: 'var(--color-text)', padding: '11px 14px', background: 'var(--color-bg)',
                      border: '1.5px solid var(--color-border-strong)', borderRadius: 'var(--radius-sm)', outline: 'none', resize: 'vertical' }} />
                </div>
                <Button type="submit" variant="primary" size="lg" iconRight="arrow-right" style={{ alignSelf: 'flex-start' }}>Versturen</Button>
              </form>
            )}
          </div>
        </div>
      </ContentSection>
    </>
  );
}

function ContactRow({ icon, label, children }) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <span style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--color-primary-soft)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
        <i data-lucide={icon} style={{ width: 19, height: 19, color: 'var(--light-red)' }} />
      </span>
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--color-text-subtle)', marginBottom: 3 }}>{label}</div>
        <div className="light-body" style={{ fontSize: 15.5, color: 'var(--color-text)', lineHeight: 1.5 }}>{children}</div>
      </div>
    </div>
  );
}
