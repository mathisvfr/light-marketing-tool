// App — composes the Light marketing homepage. Single-page interactive demo.
function App() {
  const [active, setActive] = React.useState('Home');
  const [toast, setToast] = React.useState(null);

  React.useEffect(() => { if (window.lucide) lucide.createIcons(); }, [active, toast]);

  const onNav = (label) => {
    setActive(label);
    if (label === 'Vacatures') {
      const el = document.getElementById('vacatures');
      if (el) window.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' });
      return;
    }
    if (label === 'Home') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    setToast(label);
    clearTimeout(window.__lt);
    window.__lt = setTimeout(() => setToast(null), 2200);
  };

  return (
    <div className="light-body" style={{ background: '#fff' }}>
      <Header onNav={onNav} active={active} />
      <Hero onNav={onNav} />
      <ServiceTiles onNav={onNav} />
      <div id="vacatures"><VacancyFeed onNav={onNav} /></div>
      <CtaBand onNav={onNav} />
      <Footer onNav={onNav} />

      {toast && (
        <div style={{ position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)', zIndex: 100,
          background: 'var(--grey-900)', color: '#fff', padding: '12px 20px', borderRadius: 'var(--radius-pill)',
          boxShadow: 'var(--shadow-md)', fontFamily: 'var(--font-body)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <i data-lucide="info" style={{ width: 16, height: 16, color: 'var(--light-red-300)' }} />
          “{toast}” is in deze demo niet uitgewerkt.
        </div>
      )}
    </div>
  );
}
